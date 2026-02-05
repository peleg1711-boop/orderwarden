// routes/metrics.js - Impact metrics and summaries
const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");

// Helper: Get authenticated user ID from Clerk
function getAuthUserId(req) {
  return req.auth?.userId || req.headers["x-clerk-user-id"] || null;
}

// Helper: Get all store IDs belonging to a user
async function getUserStoreIds(userId) {
  const stores = await prisma.store.findMany({
    where: { userId },
    select: { id: true }
  });
  return stores.map(s => s.id);
}

function parseRangeDays(rangeParam) {
  if (!rangeParam) return 30;
  const trimmed = String(rangeParam).trim();
  const match = trimmed.match(/^(\d+)\s*d$/i);
  const numeric = match ? Number(match[1]) : Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) return 30;
  return Math.min(Math.max(Math.floor(numeric), 1), 365);
}

function toNumberOrDefault(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildSummary(events) {
  const trackingChecks = events.filter(e => e.type === "tracking_checked").length;
  const riskFlagged = events.filter(e =>
    e.type === "risk_changed" &&
    ["yellow", "red"].includes(e.metadata?.to)
  ).length;
  const riskResolved = events.filter(e =>
    e.type === "risk_changed" &&
    ["yellow", "red"].includes(e.metadata?.from) &&
    e.metadata?.to === "green"
  ).length;

  const eventsByOrder = new Map();
  for (const event of events) {
    const list = eventsByOrder.get(event.orderId) || [];
    list.push(event);
    eventsByOrder.set(event.orderId, list);
  }

  let deliveredAfterRisk = 0;
  for (const list of eventsByOrder.values()) {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let hadRisk = false;
    for (const event of list) {
      if (event.type === "risk_changed" && ["yellow", "red"].includes(event.metadata?.to)) {
        hadRisk = true;
      }
      if (event.type === "status_changed" && event.metadata?.to === "delivered" && hadRisk) {
        deliveredAfterRisk += 1;
        break;
      }
    }
  }

  const avgOrderValue = toNumberOrDefault(process.env.AVG_ORDER_VALUE, 45);
  const refundRateEstimate = toNumberOrDefault(process.env.REFUND_RATE_ESTIMATE, 0.1);
  const estimatedRefundsAvoided = Number((riskResolved * avgOrderValue * refundRateEstimate).toFixed(2));

  return {
    trackingChecks,
    riskFlagged,
    riskResolved,
    deliveredAfterRisk,
    estimatedRefundsAvoided
  };
}

router.get("/summary", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const rangeDays = parseRangeDays(req.query.range);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const storeIds = await getUserStoreIds(userId);
    const orders = await prisma.order.findMany({
      where: { storeId: { in: storeIds } },
      select: { id: true }
    });
    const orderIds = orders.map(o => o.id);

    if (orderIds.length === 0) {
      return res.json({
        trackingChecks: 0,
        riskFlagged: 0,
        riskResolved: 0,
        deliveredAfterRisk: 0,
        estimatedRefundsAvoided: 0,
        rangeDays,
        generatedAt: new Date().toISOString()
      });
    }

    const events = await prisma.orderEvent.findMany({
      where: {
        orderId: { in: orderIds },
        createdAt: { gte: since }
      },
      select: {
        orderId: true,
        type: true,
        metadata: true,
        createdAt: true
      }
    });

    const summary = buildSummary(events);
    res.json({
      ...summary,
      rangeDays,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Metrics] Summary error:", error);
    res.status(500).json({ error: "Failed to fetch metrics summary" });
  }
});

module.exports = router;
