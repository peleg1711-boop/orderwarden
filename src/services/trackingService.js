// services/trackingService.js
// 17TRACK API integration

const TRACK17_API_KEY = process.env.TRACK17_API_KEY;
const TRACK17_API_URL = 'https://api.17track.net/track/v2.2';

// 17TRACK carrier codes
const CARRIER_CODES = {
  usps: 21051,
  ups: 100002,
  fedex: 100003,
  dhl: 100001
};

/**
 * Check tracking status for a package using 17TRACK
 */
async function checkTrackingStatus(trackingNumber, carrier = null) {
  console.log(`[TrackingService] Checking ${trackingNumber} (carrier: ${carrier || "auto-detect"})`);

  try {
    // If no API key, fall back to mock data
    if (!TRACK17_API_KEY) {
      console.warn('[TrackingService] No 17TRACK API key - using mock data');
      return getMockTrackingData(trackingNumber, carrier);
    }

    // Detect carrier code if not provided
    const carrierCode = carrier ? getCarrierCode(carrier) : detectCarrierCode(trackingNumber);

    // First, register the tracking (17TRACK requires this)
    await registerTracking(trackingNumber, carrierCode);

    // Then get tracking info
    const trackingData = await getTrackingInfo(trackingNumber, carrierCode);

    // Normalize the 17TRACK response
    const normalized = normalize17TrackData(trackingData, trackingNumber);
    console.log(`[TrackingService] Result - Status: ${normalized.status}, Risk: ${normalized.riskLevel}`);

    return normalized;

  } catch (error) {
    console.error(`[TrackingService] Error checking ${trackingNumber}:`, error.message);

    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: carrier || getCarrierName(detectCarrierCode(trackingNumber)) || "unknown",
      lastUpdate: new Date(),
      location: null,
      message: null,
      error: error.message
    };
  }
}


/**
 * Register tracking number with 17TRACK
 */
async function registerTracking(trackingNumber, carrierCode) {
  const body = [{
    number: trackingNumber,
    carrier: carrierCode
  }];

  console.log(`[TrackingService] Registering tracking:`, JSON.stringify(body));

  const response = await fetch(`${TRACK17_API_URL}/register`, {
    method: 'POST',
    headers: {
      '17token': TRACK17_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log(`[TrackingService] Register response:`, JSON.stringify(data));

  // 17TRACK returns code 0 for success, but also accepts already registered
  if (data.code !== 0 && data.code !== 0) {
    console.log(`[TrackingService] Register note: code=${data.code}, message=${data.data?.errors?.[0]?.message || 'unknown'}`);
  }

  return data;
}


/**
 * Get tracking info from 17TRACK
 */
async function getTrackingInfo(trackingNumber, carrierCode) {
  const body = [{
    number: trackingNumber,
    carrier: carrierCode
  }];

  console.log(`[TrackingService] Getting tracking info:`, JSON.stringify(body));

  const response = await fetch(`${TRACK17_API_URL}/gettrackinfo`, {
    method: 'POST',
    headers: {
      '17token': TRACK17_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log(`[TrackingService] GetTrackInfo response:`, JSON.stringify(data));

  if (data.code !== 0) {
    throw new Error(data.data?.errors?.[0]?.message || `API error: code ${data.code}`);
  }

  return data;
}


/**
 * Normalize 17TRACK response to our standard format
 */
function normalize17TrackData(apiResponse, trackingNumber) {
  // Find the tracking data in the response
  const accepted = apiResponse.data?.accepted || [];
  const tracking = accepted.find(t => t.number === trackingNumber);

  if (!tracking || !tracking.track) {
    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: "unknown",
      lastUpdate: new Date(),
      location: null,
      message: "No tracking data available"
    };
  }

  const trackInfo = tracking.track;

  // 17TRACK status codes to our status mapping
  // e = package status: 0=Not Found, 10=In Transit, 20=Expired, 30=Ready to pick up,
  //                     35=Undelivered, 40=Delivered, 50=Alert
  const statusMap = {
    0: 'unknown',
    10: 'in_transit',
    20: 'pre_transit',
    30: 'out_for_delivery',
    35: 'delivery_failed',
    40: 'delivered',
    50: 'exception'
  };

  const statusCode = trackInfo.e || 0;
  const status = statusMap[statusCode] || 'unknown';

  // Get latest checkpoint from z1 (latest tracking events) or z0 (origin tracking)
  const checkpoints = trackInfo.z1 || trackInfo.z0 || [];
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[0] : null; // 17TRACK returns newest first

  // Parse last update time
  let lastUpdate = new Date();
  if (latestCheckpoint?.a) {
    // 17TRACK uses Unix timestamp in seconds
    lastUpdate = new Date(latestCheckpoint.a * 1000);
  }

  // Get location from latest checkpoint
  let location = null;
  if (latestCheckpoint?.c) {
    location = latestCheckpoint.c; // Location string
  }

  // Get message from latest checkpoint
  const message = latestCheckpoint?.z || null;

  // Calculate risk level
  const riskLevel = calculateRiskLevel(status, lastUpdate);

  // Get carrier name
  const carrierName = getCarrierName(trackInfo.b) || 'unknown';

  return {
    status,
    riskLevel,
    carrier: carrierName,
    lastUpdate,
    location,
    message,
    deliveryDate: null
  };
}


/**
 * Calculate risk level based on tracking status and time
 */
function calculateRiskLevel(status, lastUpdateTime) {
  const normalizedStatus = status.toLowerCase();

  // Red flags - high risk
  if (["exception", "delivery_failed", "lost"].includes(normalizedStatus)) {
    return "red";
  }

  // Green - all good
  if (["delivered", "out_for_delivery"].includes(normalizedStatus)) {
    return "green";
  }

  // Check time since last update for in_transit packages
  if (normalizedStatus === "in_transit") {
    const hoursSinceUpdate = (Date.now() - new Date(lastUpdateTime)) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 72) return "red";
    if (hoursSinceUpdate > 48) return "yellow";
  }

  // Pre-transit for more than 48 hours
  if (normalizedStatus === "pre_transit") {
    const hoursSinceUpdate = (Date.now() - new Date(lastUpdateTime)) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 48) return "yellow";
  }

  // Unknown status
  if (normalizedStatus === "unknown") return "yellow";

  return "green";
}


/**
 * Get 17TRACK carrier code from carrier name
 */
function getCarrierCode(carrier) {
  if (!carrier) return CARRIER_CODES.usps;

  const normalized = carrier.toLowerCase();
  return CARRIER_CODES[normalized] || CARRIER_CODES.usps;
}


/**
 * Get carrier name from 17TRACK carrier code
 */
function getCarrierName(carrierCode) {
  for (const [name, code] of Object.entries(CARRIER_CODES)) {
    if (code === carrierCode) return name;
  }
  return 'unknown';
}


/**
 * Detect carrier code from tracking number format
 */
function detectCarrierCode(trackingNumber) {
  if (!trackingNumber) return CARRIER_CODES.usps;

  // USPS: 20-22 digits or specific formats (94, 92, 93, 95, 42 prefix)
  if (/^\d{20,22}$/.test(trackingNumber) || /^(94|92|93|95|42)\d{18,}$/.test(trackingNumber)) {
    return CARRIER_CODES.usps;
  }

  // UPS: 1Z followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/i.test(trackingNumber)) {
    return CARRIER_CODES.ups;
  }

  // FedEx: 12-14 digits or 22 digits
  if (/^\d{12,14}$/.test(trackingNumber) || /^\d{22}$/.test(trackingNumber)) {
    return CARRIER_CODES.fedex;
  }

  return CARRIER_CODES.usps; // Default to USPS for Etsy sellers
}


/**
 * Detect carrier name from tracking number (for backwards compatibility)
 */
function detectCarrier(trackingNumber) {
  const code = detectCarrierCode(trackingNumber);
  return getCarrierName(code);
}


/**
 * Normalize carrier name (for backwards compatibility)
 */
function normalizeCarrierSlug(carrier) {
  if (!carrier) return null;
  return carrier.toLowerCase();
}


/**
 * Mock tracking data (fallback when no API key)
 */
function getMockTrackingData(trackingNumber, carrier) {
  console.log('[TrackingService] Using mock data');

  return {
    status: "in_transit",
    riskLevel: "green",
    carrier: carrier || detectCarrier(trackingNumber) || "usps",
    lastUpdate: new Date(),
    location: "In Transit",
    message: "Package is on its way",
    deliveryDate: null
  };
}

module.exports = {
  checkTrackingStatus,
  calculateRiskLevel,
  detectCarrier,
  normalizeCarrierSlug
};
