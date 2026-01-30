// routes/etsy.js - Etsy OAuth and sync endpoints
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const etsyService = require('../services/etsyService');

// Helper: Get authenticated user ID from request
function getAuthUserId(req) {
  return req.auth?.userId || req.headers['x-clerk-user-id'];
}

// Dashboard URL for redirects
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://orderwarden.com';

/**
 * GET /api/etsy/auth
 * Start OAuth flow - generates PKCE and redirects to Etsy
 */
router.get('/auth', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log(`[Etsy] Starting OAuth for user ${userId}`);
    
    // Generate PKCE challenge
    const { verifier, challenge } = etsyService.generatePKCE();
    const state = etsyService.generateState();

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@orderwarden.local` }
    });
    
    // Store PKCE verifier temporarily (will be used in callback)
    // Using upsert in case user already has a partial connection
    await prisma.etsyConnection.upsert({
      where: { userId },
      update: {
        codeVerifier: verifier,
        oauthState: state
      },
      create: {
        userId,
        codeVerifier: verifier,
        oauthState: state,
        // Placeholder values - will be updated in callback
        etsyUserId: '',
        etsyShopId: '',
        shopName: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: new Date()
      }
    });
    
    // Build and redirect to Etsy authorization URL
    const authUrl = etsyService.getAuthorizationUrl(state, challenge);
    console.log(`[Etsy] Redirecting to Etsy OAuth`);
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('[Etsy] Auth start error:', error);
    res.redirect(`${DASHBOARD_URL}?etsy_error=auth_failed`);
  }
});


/**
 * GET /api/etsy/callback
 * Handle OAuth callback from Etsy
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle Etsy errors
    if (error) {
      console.error(`[Etsy] OAuth error: ${error} - ${error_description}`);
      return res.redirect(`${DASHBOARD_URL}?etsy_error=${error}`);
    }
    
    if (!code || !state) {
      console.error('[Etsy] Missing code or state');
      return res.redirect(`${DASHBOARD_URL}?etsy_error=missing_params`);
    }
    
    console.log(`[Etsy] Processing callback with state ${state}`);
    
    // Find the connection with matching state
    const connection = await prisma.etsyConnection.findFirst({
      where: { oauthState: state }
    });
    
    if (!connection) {
      console.error('[Etsy] No matching state found');
      return res.redirect(`${DASHBOARD_URL}?etsy_error=invalid_state`);
    }

    
    // Exchange code for tokens
    console.log('[Etsy] Exchanging code for tokens');
    const tokens = await etsyService.exchangeCodeForTokens(code, connection.codeVerifier);
    
    // Get user info from Etsy
    console.log('[Etsy] Fetching user info');
    const etsyUser = await etsyService.getMe(tokens.access_token);
    
    // Get shop info
    console.log(`[Etsy] Fetching shop for user ${etsyUser.user_id}`);
    const shopResponse = await etsyService.getShop(tokens.access_token, etsyUser.user_id);
    
    if (!shopResponse || shopResponse.count === 0) {
      console.error('[Etsy] User has no shop');
      return res.redirect(`${DASHBOARD_URL}?etsy_error=no_shop`);
    }
    
    const shop = shopResponse.results[0];
    console.log(`[Etsy] Found shop: ${shop.shop_name} (ID: ${shop.shop_id})`);
    
    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    
    // Update connection with real data
    await prisma.etsyConnection.update({
      where: { id: connection.id },
      data: {
        etsyUserId: etsyUser.user_id.toString(),
        etsyShopId: shop.shop_id.toString(),
        shopName: shop.shop_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        // Clear temporary PKCE data
        codeVerifier: null,
        oauthState: null
      }
    });
    
    console.log(`[Etsy] Successfully connected shop ${shop.shop_name} for user ${connection.userId}`);
    res.redirect(`${DASHBOARD_URL}?etsy_connected=true&shop=${encodeURIComponent(shop.shop_name)}`);
    
  } catch (error) {
    console.error('[Etsy] Callback error:', error);
    res.redirect(`${DASHBOARD_URL}?etsy_error=callback_failed`);
  }
});


/**
 * GET /api/etsy/status
 * Check if user has connected Etsy
 */
router.get('/status', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const connection = await prisma.etsyConnection.findUnique({
      where: { userId },
      select: {
        shopName: true,
        etsyShopId: true,
        lastSyncAt: true,
        syncEnabled: true
      }
    });
    
    // Check if it's a real connection (has shop data)
    if (!connection || !connection.etsyShopId) {
      return res.json({ connected: false });
    }
    
    res.json({
      connected: true,
      shopName: connection.shopName,
      lastSyncAt: connection.lastSyncAt,
      syncEnabled: connection.syncEnabled
    });
    
  } catch (error) {
    console.error('[Etsy] Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});


/**
 * POST /api/etsy/sync
 * Manually trigger order sync from Etsy
 */
router.post('/sync', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const connection = await prisma.etsyConnection.findUnique({
      where: { userId }
    });
    
    if (!connection || !connection.etsyShopId) {
      return res.status(400).json({ error: 'Etsy not connected' });
    }
    
    console.log(`[Etsy] Starting sync for shop ${connection.shopName}`);
    
    // Check if token needs refresh
    let accessToken = connection.accessToken;
    if (new Date() >= connection.tokenExpiresAt) {
      console.log('[Etsy] Token expired, refreshing...');
      const tokens = await etsyService.refreshAccessToken(connection.refreshToken);
      accessToken = tokens.access_token;
      
      // Update stored tokens
      await prisma.etsyConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
        }
      });
    }

    
    // Get user's store for orders
    let store = await prisma.store.findFirst({
      where: { userId }
    });
    
    if (!store) {
      // Create store if doesn't exist
      store = await prisma.store.create({
        data: {
          userId,
          platform: 'etsy',
          storeName: connection.shopName
        }
      });
    }
    
    // Fetch receipts from Etsy (last 30 days by default)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const receiptsResponse = await etsyService.getShopReceipts(
      accessToken,
      connection.etsyShopId,
      { minCreated: thirtyDaysAgo }
    );
    
    console.log(`[Etsy] Found ${receiptsResponse.count} receipts`);
    
    let imported = 0;
    let skipped = 0;

    
    // Process each receipt
    for (const receipt of receiptsResponse.results || []) {
      // Skip if no shipments
      if (!receipt.shipments || receipt.shipments.length === 0) {
        skipped++;
        continue;
      }
      
      const shipment = receipt.shipments[0];
      if (!shipment.tracking_code) {
        skipped++;
        continue;
      }
      
      const orderId = receipt.receipt_id.toString();
      
      // Check if order already exists
      const existing = await prisma.order.findUnique({
        where: { orderId }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Create new order
      await prisma.order.create({
        data: {
          storeId: store.id,
          orderId,
          trackingNumber: shipment.tracking_code,
          carrier: etsyService.mapEtsyCarrier(shipment.carrier_name),
          riskLevel: 'green'  // Default, will be updated by tracking check
        }
      });
      
      imported++;
    }

    
    // Update last sync time
    await prisma.etsyConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() }
    });
    
    console.log(`[Etsy] Sync complete: ${imported} imported, ${skipped} skipped`);
    
    res.json({
      success: true,
      imported,
      skipped,
      total: receiptsResponse.count
    });
    
  } catch (error) {
    console.error('[Etsy] Sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

/**
 * POST /api/etsy/disconnect
 * Remove Etsy connection
 */
router.post('/disconnect', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    await prisma.etsyConnection.deleteMany({
      where: { userId }
    });
    
    console.log(`[Etsy] Disconnected for user ${userId}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('[Etsy] Disconnect error:', error);
    res.status(500).json({ error: 'Disconnect failed' });
  }
});

module.exports = router;
