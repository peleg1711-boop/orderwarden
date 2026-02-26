// routes/orders.js - Per-user filtering enabled
const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");

// Import tracking service
const { checkTrackingStatus } = require("../services/trackingService");

// Import message templates helper
const { getMessageTemplate } = require("../utils/messageTemplates");

// Constants
const FREE_ORDER_LIMIT = 10;

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

// Helper: Ensure user and store exist, then return store IDs
async function ensureUserAndGetStoreIds(userId) {
  // Upsert user (same pattern as /api/me/store)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@orderwarden.local`,
    },
  });

  // Find existing stores
  let stores = await prisma.store.findMany({
    where: { userId },
    select: { id: true }
  });

  // Auto-create default store if none exists
  if (stores.length === 0) {
    const newStore = await prisma.store.create({
      data: {
        userId,
        platform: "etsy",
        storeName: "My Store",
      },
      select: { id: true },
    });
    stores = [newStore];
  }

  return stores.map(s => s.id);
}

// GET /api/orders - List orders for authenticated user only
router.get("/", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const storeIds = await getUserStoreIds(userId);

    // Auto-assign orphaned orders (no storeId) to user's default store
    const defaultStoreId = storeIds[0];
    if (defaultStoreId) {
      await prisma.order.updateMany({
        where: { storeId: null },
        data: { storeId: defaultStoreId }
      });
    }

    const orders = await prisma.order.findMany({
      where: { storeId: { in: storeIds } },
      orderBy: { createdAt: "desc" }
    });

    res.json({ orders });
  } catch (error) {
    console.error("[Orders] List error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id - Get single order (only if user owns it)
router.get("/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const storeIds = await getUserStoreIds(userId);
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        storeId: { in: storeIds }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("[Orders] Get error:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// Helper: Check if we need to reset monthly order count
function shouldResetOrderCount(orderCountResetAt) {
  if (!orderCountResetAt) return true;

  const now = new Date();
  const resetDate = new Date(orderCountResetAt);

  // Reset if we're in a different month
  return now.getMonth() !== resetDate.getMonth() ||
         now.getFullYear() !== resetDate.getFullYear();
}

// POST /api/orders - Create new order (authenticated, auto-assigns to user's store)
router.post("/", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { orderId, trackingNumber, carrier, storeId } = req.body;

    // Validation
    if (!orderId || !trackingNumber) {
      return res.status(400).json({
        error: "orderId and trackingNumber are required"
      });
    }

    // Ensure user and store exist (auto-creates if missing)
    const storeIds = await ensureUserAndGetStoreIds(userId);

    // Get user to check subscription status and order count
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Reset monthly count if needed
    if (user && shouldResetOrderCount(user.orderCountResetAt)) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          monthlyOrderCount: 0,
          orderCountResetAt: new Date(),
        },
      });
    }

    // Check order limit for free users
    if (user && user.planType !== "pro" && user.monthlyOrderCount >= FREE_ORDER_LIMIT) {
      return res.status(403).json({
        error: "Monthly order limit reached",
        message: `Free plan allows ${FREE_ORDER_LIMIT} orders per month. Upgrade to Pro for unlimited orders.`,
        upgradeRequired: true,
        currentCount: user.monthlyOrderCount,
        limit: FREE_ORDER_LIMIT,
      });
    }

    // Determine which store to use
    let assignedStoreId = storeId;
    if (storeId) {
      // Verify user owns this store
      if (!storeIds.includes(storeId)) {
        return res.status(403).json({ error: "You don't own this store" });
      }
    } else {
      // Auto-assign to user's default store
      assignedStoreId = storeIds[0];
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orderId,
        trackingNumber,
        carrier: carrier || null,
        storeId: assignedStoreId,
        riskLevel: "green" // Default to green until first check
      }
    });

    // Increment monthly order count
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyOrderCount: { increment: 1 },
        orderCountResetAt: user?.orderCountResetAt || new Date(),
      },
    });

    console.log(`[Orders] Created order ${order.id} for Etsy order ${orderId} (user: ${userId})`);
    res.status(201).json({ order });

  } catch (error) {
    console.error("[Orders] Create error:", error);

    // Handle duplicate orderId
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Order with this orderId already exists"
      });
    }

    res.status(500).json({ error: "Failed to create order" });
  }
});

// POST /api/orders/:id/check - Check tracking and update risk (only if user owns it)
router.post("/:id/check", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const storeIds = await getUserStoreIds(userId);
    const { id } = req.params;

    console.log(`[Orders] Checking tracking for order ${id} (user: ${userId})`);

    // 1. Get order (only if user owns it)
    const order = await prisma.order.findFirst({
      where: {
        id,
        storeId: { in: storeIds }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // 2. Check tracking status
    console.log(`[Orders] Fetching tracking for ${order.trackingNumber}`);
    const trackingResult = await checkTrackingStatus(order.trackingNumber, order.carrier);

    console.log(`[Orders] Tracking result - Status: ${trackingResult.status}, Risk: ${trackingResult.riskLevel}`);

    // 3. Update database with tracking info
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        lastStatus: trackingResult.status,
        lastUpdateAt: new Date(),
        riskLevel: trackingResult.riskLevel,
        carrier: trackingResult.carrier || order.carrier // Update carrier if detected
      }
    });

    // 4. Get recommended message template
    const recommendedMessage = getMessageTemplate(
      trackingResult.status,
      trackingResult.riskLevel,
      order.orderId
    );

    // 4b. Log tracking events for impact metrics (non-blocking)
    const eventData = [];
    eventData.push({
      orderId: order.id,
      type: "tracking_checked",
      metadata: {
        status: trackingResult.status,
        carrier: trackingResult.carrier || order.carrier || null
      }
    });
    if (order.lastStatus !== trackingResult.status) {
      eventData.push({
        orderId: order.id,
        type: "status_changed",
        metadata: { from: order.lastStatus, to: trackingResult.status }
      });
    }
    if (order.riskLevel !== trackingResult.riskLevel) {
      eventData.push({
        orderId: order.id,
        type: "risk_changed",
        metadata: { from: order.riskLevel, to: trackingResult.riskLevel }
      });
    }
    if (eventData.length > 0) {
      try {
        await prisma.orderEvent.createMany({ data: eventData });
      } catch (eventError) {
        console.error("[Orders] Event log error:", eventError);
      }
    }

    console.log(`[Orders] Updated order ${id} - Risk: ${updatedOrder.riskLevel}`);

    // 5. Return everything
    res.json({
      order: updatedOrder,
      tracking: {
        status: trackingResult.status,
        lastUpdate: trackingResult.lastUpdate,
        location: trackingResult.location,
        riskLevel: trackingResult.riskLevel,
        carrier: trackingResult.carrier,
        events: trackingResult.events || []
      },
      recommendedMessage
    });

  } catch (error) {
    console.error("[Orders] Check error:", error);
    res.status(500).json({
      error: "Failed to check tracking",
      details: error.message
    });
  }
});

// DELETE /api/orders/:id - Delete order (only if user owns it)
router.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const storeIds = await getUserStoreIds(userId);
    const { id } = req.params;

    // Verify user owns this order before deleting
    const order = await prisma.order.findFirst({
      where: {
        id,
        storeId: { in: storeIds }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await prisma.$transaction([
      prisma.orderEvent.deleteMany({
        where: { orderId: id }
      }),
      prisma.order.delete({
        where: { id }
      })
    ]);

    console.log(`[Orders] Deleted order ${id} (user: ${userId})`);
    res.json({ success: true });

  } catch (error) {
    console.error("[Orders] Delete error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(500).json({ error: "Failed to delete order" });
  }
});

module.exports = router;
