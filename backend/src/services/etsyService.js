// services/etsyService.js - Etsy OAuth and API integration
const crypto = require('crypto');

const ETSY_CLIENT_ID = process.env.ETSY_CLIENT_ID;
const ETSY_REDIRECT_URI = process.env.ETSY_REDIRECT_URI || 'https://api.orderwarden.com/api/etsy/callback';
const ETSY_API_BASE = 'https://api.etsy.com/v3';
const ETSY_AUTH_BASE = 'https://www.etsy.com/oauth';

// Required scopes for OrderWarden
const SCOPES = ['shops_r', 'transactions_r'];

/**
 * Generate PKCE code verifier and challenge
 * Required by Etsy OAuth 2.0
 */
function generatePKCE() {
  // Generate random 32-byte code verifier
  const verifier = crypto.randomBytes(32)
    .toString('base64url')
    .slice(0, 43);
  
  // Create SHA256 hash for challenge
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
}

/**
 * Generate random state parameter for CSRF protection
 */
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}
/**
 * Build Etsy authorization URL
 */
function getAuthorizationUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: ETSY_CLIENT_ID,
    redirect_uri: ETSY_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  return `${ETSY_AUTH_BASE}/connect?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens
 */
async function exchangeCodeForTokens(code, codeVerifier) {
  const response = await fetch(`${ETSY_API_BASE}/public/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ETSY_CLIENT_ID,
      redirect_uri: ETSY_REDIRECT_URI,
      code: code,
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Etsy] Token exchange failed:', error);
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  return response.json();
}

/**
 * Refresh an expired access token
 */
async function refreshAccessToken(refreshToken) {
  const response = await fetch(`${ETSY_API_BASE}/public/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ETSY_CLIENT_ID,
      refresh_token: refreshToken
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Etsy] Token refresh failed:', error);
    throw new Error(`Token refresh failed: ${error}`);
  }
  
  return response.json();
}


/**
 * Get authenticated user's info (includes user_id needed for shop lookup)
 */
async function getMe(accessToken) {
  const response = await fetch(`${ETSY_API_BASE}/application/users/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': ETSY_CLIENT_ID
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Etsy] Get user failed:', error);
    throw new Error(`Get user failed: ${error}`);
  }
  
  return response.json();
}

/**
 * Get user's shop info
 */
async function getShop(accessToken, etsyUserId) {
  const response = await fetch(`${ETSY_API_BASE}/application/users/${etsyUserId}/shops`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': ETSY_CLIENT_ID
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Etsy] Get shop failed:', error);
    throw new Error(`Get shop failed: ${error}`);
  }
  
  return response.json();
}

/**
 * Get shop receipts (orders) with optional filters
 * @param {string} accessToken
 * @param {string} shopId
 * @param {object} options - { minCreated, limit, offset }
 */
async function getShopReceipts(accessToken, shopId, options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 100,
    offset: options.offset || 0,
    was_shipped: 'true'  // Only get shipped orders (have tracking)
  });
  
  if (options.minCreated) {
    params.set('min_created', Math.floor(options.minCreated / 1000)); // Unix timestamp
  }
  
  const response = await fetch(
    `${ETSY_API_BASE}/application/shops/${shopId}/receipts?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': ETSY_CLIENT_ID
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Etsy] Get receipts failed:', error);
    throw new Error(`Get receipts failed: ${error}`);
  }
  
  return response.json();
}

/**
 * Map Etsy carrier names to standard carriers
 */
function mapEtsyCarrier(etsyCarrier) {
  if (!etsyCarrier) return null;
  
  const carrierMap = {
    'usps': 'usps',
    'ups': 'ups',
    'fedex': 'fedex',
    'dhl': 'dhl',
    'dhl-express': 'dhl',
    'royal-mail': 'royal-mail',
    'canada-post': 'canada-post',
    'australia-post': 'australia-post'
  };
  
  const normalized = etsyCarrier.toLowerCase().replace(/\s+/g, '-');
  return carrierMap[normalized] || etsyCarrier.toLowerCase();
}

module.exports = {
  generatePKCE,
  generateState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getMe,
  getShop,
  getShopReceipts,
  mapEtsyCarrier,
  ETSY_CLIENT_ID
};
