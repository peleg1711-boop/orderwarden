// routes/orders.js - FIXED VERSION
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Import tracking service
const { checkTrackingStatus } = require("../services/trackingService");

// Import message templates helper
const { getMessageTemplate } = require("../utils/messageTemplates");

// GET /api/orders - List all orders
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ orders });
  } catch (error) {
    console.error("[Orders] List error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id - Get single order
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id }
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

// POST /api/orders - Create new order
router.post("/", async (req, res) => {
  try {
    const { orderId, trackingNumber, carrier } = req.body;
    
    // Validation
    if (!orderId || !trackingNumber) {
      return res.status(400).json({ 
        error: "orderId and trackingNumber are required" 
      });
    }
    
    // Create order
    const order = await prisma.order.create({
      data: {
        orderId,
        trackingNumber,
        carrier: carrier || null,
        riskLevel: "green" // Default to green until first check
      }
    });
    
    console.log(`[Orders] Created order ${order.id} for Etsy order ${orderId}`);
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

// POST /api/orders/:id/check - Check tracking and update risk
router.post("/:id/check", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[Orders] Checking tracking for order ${id}`);
    
    // 1. Get order
    const order = await prisma.order.findUnique({
      where: { id }
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
    
    console.log(`[Orders] Updated order ${id} - Risk: ${updatedOrder.riskLevel}`);
    
    // 5. Return everything
    res.json({
      order: updatedOrder,
      tracking: {
        status: trackingResult.status,
        lastUpdate: trackingResult.lastUpdate,
        location: trackingResult.location,
        riskLevel: trackingResult.riskLevel,
        carrier: trackingResult.carrier
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

// DELETE /api/orders/:id - Delete order (for testing)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.order.delete({
      where: { id }
    });
    
    console.log(`[Orders] Deleted order ${id}`);
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
