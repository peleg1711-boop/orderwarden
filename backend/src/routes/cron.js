// routes/cron.js - Automated background tasks
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { checkTrackingStatus } = require('../services/trackingService');

// Secret key to protect cron endpoints (set in Railway env vars)
const CRON_SECRET = process.env.CRON_SECRET || 'default-cron-secret';

// Middleware to verify cron requests
function verifyCronSecret(req, res, next) {
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  
  if (providedSecret !== CRON_SECRET) {
    console.log('[Cron] Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

/**
 * POST /api/cron/check-tracking
 * Automated tracking check for all non-delivered orders
 * Should be called by Railway cron every 2-4 hours
 */
router.post('/check-tracking', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();
  console.log('[Cron] Starting automated tracking check...');
  
  try {
    // Get all orders that aren't delivered and haven't been checked in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const orders = await prisma.order.findMany({
      where: {
        AND: [
          // Not delivered
          { lastStatus: { not: 'delivered' } },
          // Either never checked OR checked more than 2 hours ago
          {
            OR: [
              { lastUpdateAt: null },
              { lastUpdateAt: { lt: twoHoursAgo } }
            ]
          }
        ]
      },
      take: 100, // Process max 100 orders per run to avoid timeouts
      orderBy: { lastUpdateAt: 'asc' } // Oldest first
    });

    console.log(`[Cron] Found ${orders.length} orders to check`);


    let checked = 0;
    let updated = 0;
    let errors = 0;
    const riskChanges = [];

    for (const order of orders) {
      try {
        console.log(`[Cron] Checking order ${order.orderId} (${order.trackingNumber})`);
        
        // Check tracking status
        const trackingResult = await checkTrackingStatus(order.trackingNumber, order.carrier);
        
        // Track if risk level changed
        const oldRisk = order.riskLevel;
        const newRisk = trackingResult.riskLevel;
        const riskChanged = oldRisk !== newRisk;
        
        // Update order in database
        await prisma.order.update({
          where: { id: order.id },
          data: {
            lastStatus: trackingResult.status,
            riskLevel: trackingResult.riskLevel,
            lastUpdateAt: new Date(),
            carrier: trackingResult.carrier || order.carrier
          }
        });
        
        checked++;
        
        if (riskChanged) {
          updated++;
          riskChanges.push({
            orderId: order.orderId,
            trackingNumber: order.trackingNumber,
            oldRisk,
            newRisk,
            status: trackingResult.status
          });
          
          console.log(`[Cron] Risk changed for ${order.orderId}: ${oldRisk} → ${newRisk}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`[Cron] Error checking order ${order.orderId}:`, err.message);
        errors++;
      }
    }


    const duration = Date.now() - startTime;
    
    // Log high-risk orders that need attention
    const highRiskOrders = riskChanges.filter(r => r.newRisk === 'red');
    if (highRiskOrders.length > 0) {
      console.log(`[Cron] ⚠️ ${highRiskOrders.length} orders became HIGH RISK:`);
      highRiskOrders.forEach(o => console.log(`  - ${o.orderId}: ${o.status}`));
    }

    const result = {
      success: true,
      duration: `${duration}ms`,
      summary: {
        totalChecked: checked,
        riskUpdated: updated,
        errors,
        highRiskAlerts: highRiskOrders.length
      },
      riskChanges: riskChanges.slice(0, 10) // Only return first 10 changes
    };
    
    console.log(`[Cron] Completed: ${checked} checked, ${updated} updated, ${errors} errors in ${duration}ms`);
    
    res.json(result);
    
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    res.status(500).json({ error: 'Cron job failed', message: error.message });
  }
});


/**
 * GET /api/cron/status
 * Get status of recent cron runs and system health
 */
router.get('/status', verifyCronSecret, async (req, res) => {
  try {
    // Count orders by status
    const orderStats = await prisma.order.groupBy({
      by: ['riskLevel'],
      _count: { id: true }
    });
    
    // Count orders not checked in 4+ hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const staleOrders = await prisma.order.count({
      where: {
        lastStatus: { not: 'delivered' },
        OR: [
          { lastUpdateAt: null },
          { lastUpdateAt: { lt: fourHoursAgo } }
        ]
      }
    });
    
    // Total active orders (not delivered)
    const activeOrders = await prisma.order.count({
      where: { lastStatus: { not: 'delivered' } }
    });
    
    res.json({
      healthy: true,
      stats: {
        activeOrders,
        staleOrders,
        byRisk: orderStats.reduce((acc, curr) => {
          acc[curr.riskLevel || 'unknown'] = curr._count.id;
          return acc;
        }, {})
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Cron] Status check error:', error);
    res.status(500).json({ healthy: false, error: error.message });
  }
});

module.exports = router;
