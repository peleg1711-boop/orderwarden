// routes/billing.js - LemonSqueezy subscription billing
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const prisma = require("../db/prisma");

// LemonSqueezy config from environment
const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const LEMONSQUEEZY_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "283010";
const LEMONSQUEEZY_VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID || "1264870";
const LEMONSQUEEZY_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "171102";

const FREE_ORDER_LIMIT = 10;

// Helper: Get authenticated user ID from Clerk
function getAuthUserId(req) {
  return req.auth?.userId || req.headers["x-clerk-user-id"] || null;
}

// Helper: Get or create user with subscription defaults
async function getOrCreateUser(userId) {
  return await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@orderwarden.local`,
      planType: "free",
      monthlyOrderCount: 0,
    },
  });
}

// Helper: Check if we need to reset monthly order count
function shouldResetOrderCount(orderCountResetAt) {
  if (!orderCountResetAt) return true;

  const now = new Date();
  const resetDate = new Date(orderCountResetAt);

  // Reset if we're in a different month
  return now.getMonth() !== resetDate.getMonth() ||
         now.getFullYear() !== resetDate.getFullYear();
}

// Helper: Get start of next month
function getNextMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * GET /api/billing/status
 * Returns user's current subscription status and order usage
 */
router.get("/status", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await getOrCreateUser(userId);

    // Check if we need to reset the monthly count
    let monthlyOrderCount = user.monthlyOrderCount;
    if (shouldResetOrderCount(user.orderCountResetAt)) {
      // Reset the count
      await prisma.user.update({
        where: { id: userId },
        data: {
          monthlyOrderCount: 0,
          orderCountResetAt: new Date(),
        },
      });
      monthlyOrderCount = 0;
    }

    res.json({
      planType: user.planType || "free",
      subscriptionStatus: user.subscriptionStatus,
      subscriptionId: user.subscriptionId,
      subscriptionEndsAt: user.subscriptionEndsAt,
      monthlyOrderCount,
      limit: user.planType === "pro" ? null : FREE_ORDER_LIMIT,
      canCreateOrder: user.planType === "pro" || monthlyOrderCount < FREE_ORDER_LIMIT,
    });
  } catch (error) {
    console.error("[Billing] Status error:", error);
    res.status(500).json({ error: "Failed to get billing status" });
  }
});

/**
 * POST /api/billing/create-checkout
 * Creates a LemonSqueezy checkout URL for the Pro plan
 */
router.post("/create-checkout", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await getOrCreateUser(userId);

    // Build checkout URL with custom data
    // LemonSqueezy checkout URL format: https://[store].lemonsqueezy.com/buy/[variant_id]
    const checkoutParams = new URLSearchParams({
      "checkout[custom][user_id]": userId,
      "checkout[email]": user.email !== `${userId}@orderwarden.local` ? user.email : "",
    });

    const checkoutUrl = `https://orderwarden.lemonsqueezy.com/buy/${LEMONSQUEEZY_VARIANT_ID}?${checkoutParams.toString()}`;

    console.log(`[Billing] Created checkout URL for user ${userId}`);

    res.json({ checkoutUrl });
  } catch (error) {
    console.error("[Billing] Create checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

/**
 * GET /api/billing/portal
 * Returns the customer portal URL for managing subscription
 */
router.get("/portal", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.subscriptionId) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    // LemonSqueezy customer portal URL
    // For now, return the general portal URL - users can manage from there
    const portalUrl = `https://orderwarden.lemonsqueezy.com/billing`;

    res.json({ portalUrl });
  } catch (error) {
    console.error("[Billing] Portal error:", error);
    res.status(500).json({ error: "Failed to get portal URL" });
  }
});

/**
 * POST /api/billing/webhook
 * Handles LemonSqueezy webhook events
 */
router.post("/webhook", async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers["x-signature"];

    if (!signature) {
      console.warn("[Billing] Webhook missing signature");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Get raw body for signature verification
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    // Verify HMAC signature
    const hmac = crypto.createHmac("sha256", LEMONSQUEEZY_WEBHOOK_SECRET);
    const digest = hmac.update(rawBody).digest("hex");

    if (signature !== digest) {
      console.warn("[Billing] Webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const userId = customData.user_id || customData.clerkUserId || customData.clerk_user_id;

    console.log(`[Billing] Webhook received: ${eventName} for user ${userId}`);

    if (!userId) {
      console.warn("[Billing] Webhook missing user_id in custom_data");
      return res.status(400).json({ error: "Missing user_id" });
    }

    const subscriptionData = payload.data?.attributes || {};
    const subscriptionId = payload.data?.id;

    // Ensure user exists
    await getOrCreateUser(userId);

    switch (eventName) {
      case "subscription_created":
        console.log(`[Billing] Subscription created for user ${userId}`);
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionId: String(subscriptionId),
            subscriptionStatus: "active",
            planType: "pro",
            lemonSqueezyCustomerId: String(subscriptionData.customer_id || ""),
            subscriptionEndsAt: subscriptionData.renews_at ? new Date(subscriptionData.renews_at) : null,
          },
        });
        break;

      case "subscription_updated":
        console.log(`[Billing] Subscription updated for user ${userId}`);
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: subscriptionData.status || "active",
            subscriptionEndsAt: subscriptionData.renews_at ? new Date(subscriptionData.renews_at) : null,
          },
        });
        break;

      case "subscription_cancelled":
        console.log(`[Billing] Subscription cancelled for user ${userId}`);
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "cancelled",
            // Keep planType as "pro" until subscription actually ends
            subscriptionEndsAt: subscriptionData.ends_at ? new Date(subscriptionData.ends_at) : null,
          },
        });
        break;

      case "subscription_expired":
        console.log(`[Billing] Subscription expired for user ${userId}`);
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "expired",
            planType: "free",
            subscriptionId: null,
            subscriptionEndsAt: null,
          },
        });
        break;

      case "subscription_payment_success":
        console.log(`[Billing] Payment success for user ${userId}`);
        // Ensure subscription is active after successful payment
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "active",
            planType: "pro",
          },
        });
        break;

      case "subscription_payment_failed":
        console.log(`[Billing] Payment failed for user ${userId}`);
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "past_due",
          },
        });
        break;

      default:
        console.log(`[Billing] Unhandled webhook event: ${eventName}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Billing] Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
