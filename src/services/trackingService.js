// services/trackingService.js
// AfterShip integration - Updated for 2024-07 API

const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;
const AFTERSHIP_API_URL = 'https://api.aftership.com/tracking/2024-07';

/**
 * Check tracking status for a package using AfterShip
 */
async function checkTrackingStatus(trackingNumber, carrier = null) {
  console.log(`[TrackingService] Checking ${trackingNumber} (carrier: ${carrier || "auto-detect"})`);
  
  try {
    // If no API key, fall back to mock data
    if (!AFTERSHIP_API_KEY) {
      console.warn('[TrackingService] No AfterShip API key - using mock data');
      return getMockTrackingData(trackingNumber, carrier);
    }
    
    // Detect carrier if not provided
    const detectedCarrier = carrier ? normalizeCarrierSlug(carrier) : detectCarrier(trackingNumber);
    
    // First, try to create the tracking
    let trackingData;
    try {
      trackingData = await createTracking(trackingNumber, detectedCarrier);
      console.log('[TrackingService] Tracking created/found in AfterShip');
    } catch (createError) {
      console.log('[TrackingService] Create failed:', createError.message);
      
      // If tracking already exists (4003), try to get it
      if (createError.message.includes('4003') || createError.message.includes('already exists')) {
        trackingData = await getTrackingById(trackingNumber, detectedCarrier);
      } else {
        throw createError;
      }
    }
    
    // Normalize the AfterShip response
    const normalized = normalizeAfterShipData(trackingData);
    console.log(`[TrackingService] Result - Status: ${normalized.status}, Risk: ${normalized.riskLevel}`);
    
    return normalized;
    
  } catch (error) {
    console.error(`[TrackingService] Error checking ${trackingNumber}:`, error.message);
    
    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: carrier || detectCarrier(trackingNumber) || "unknown",
      lastUpdate: new Date(),
      location: null,
      message: null,
      error: error.message
    };
  }
}


/**
 * Create new tracking in AfterShip (2024-07 API)
 * Note: 2024-07 API uses flat body format, not nested
 */
async function createTracking(trackingNumber, carrierSlug = null) {
  // 2024-07 API expects flat body, NOT nested {"tracking":{...}}
  const body = {
    tracking_number: trackingNumber
  };

  if (carrierSlug) {
    body.slug = carrierSlug;
  }

  console.log(`[TrackingService] Creating tracking:`, JSON.stringify(body));

  const response = await fetch(`${AFTERSHIP_API_URL}/trackings`, {
    method: 'POST',
    headers: {
      'as-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log(`[TrackingService] Create response:`, JSON.stringify(data));

  if (!response.ok) {
    // Check if tracking already exists (code 4003)
    if (data.meta?.code === 4003) {
      throw new Error('4003: Tracking already exists');
    }
    throw new Error(data.meta?.message || `API error: ${response.status}`);
  }

  // 2024-07 API returns tracking object directly in data, not data.tracking
  return data.data;
}


/**
 * Get tracking by slug and tracking number (2024-07 API)
 */
async function getTrackingById(trackingNumber, carrierSlug = null) {
  const slug = carrierSlug || 'usps';
  
  // First get list of trackings to find the ID
  const listUrl = `${AFTERSHIP_API_URL}/trackings?tracking_numbers=${trackingNumber}`;
  console.log(`[TrackingService] Getting tracking list from: ${listUrl}`);
  
  const listResponse = await fetch(listUrl, {
    method: 'GET',
    headers: {
      'as-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  const listData = await listResponse.json();
  console.log(`[TrackingService] List response:`, JSON.stringify(listData));
  
  if (!listResponse.ok) {
    throw new Error(listData.meta?.message || `API error: ${listResponse.status}`);
  }
  
  const trackings = listData.data?.trackings || [];
  if (trackings.length === 0) {
    throw new Error('Tracking not found');
  }
  
  return trackings[0];
}


/**
 * Normalize AfterShip response to our standard format
 */
function normalizeAfterShipData(tracking) {
  if (!tracking) {
    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: "unknown",
      lastUpdate: new Date(),
      location: null,
      message: null
    };
  }
  
  // AfterShip tag to our status mapping
  const statusMap = {
    'Pending': 'pre_transit',
    'InfoReceived': 'pre_transit',
    'InTransit': 'in_transit',
    'OutForDelivery': 'out_for_delivery',
    'AttemptFail': 'delivery_failed',
    'Delivered': 'delivered',
    'Exception': 'exception',
    'Expired': 'lost',
    'AvailableForPickup': 'out_for_delivery'
  };
  
  const aftershipTag = tracking.tag || 'Pending';
  const status = statusMap[aftershipTag] || 'unknown';
  
  // Get latest checkpoint
  const checkpoints = tracking.checkpoints || [];
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  
  const lastUpdate = latestCheckpoint?.checkpoint_time 
    ? new Date(latestCheckpoint.checkpoint_time)
    : new Date(tracking.created_at || Date.now());
  
  // Calculate risk level
  const riskLevel = calculateRiskLevel(status, lastUpdate, tracking);
  
  // Get location
  let location = null;
  if (latestCheckpoint) {
    const parts = [];
    if (latestCheckpoint.city) parts.push(latestCheckpoint.city);
    if (latestCheckpoint.state) parts.push(latestCheckpoint.state);
    location = parts.join(', ') || null;
  }
  
  return {
    status,
    riskLevel,
    carrier: tracking.slug || 'unknown',
    lastUpdate,
    location,
    message: latestCheckpoint?.message || null,
    deliveryDate: tracking.expected_delivery ? new Date(tracking.expected_delivery) : null
  };
}


/**
 * Calculate risk level based on tracking status and time
 */
function calculateRiskLevel(status, lastUpdateTime, tracking = null) {
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
 * Normalize carrier name to AfterShip slug
 */
function normalizeCarrierSlug(carrier) {
  if (!carrier) return null;
  
  const slugMap = {
    'USPS': 'usps',
    'usps': 'usps',
    'UPS': 'ups',
    'ups': 'ups',
    'FEDEX': 'fedex',
    'FedEx': 'fedex',
    'fedex': 'fedex',
    'DHL': 'dhl',
    'dhl': 'dhl'
  };
  
  return slugMap[carrier] || carrier.toLowerCase();
}


/**
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber) {
  if (!trackingNumber) return null;
  
  // USPS: 20-22 digits or specific formats
  if (/^\d{20,22}$/.test(trackingNumber) || /^(94|92|93|95|42)\d{18,}$/.test(trackingNumber)) {
    return "usps";
  }
  
  // UPS: 1Z followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/i.test(trackingNumber)) {
    return "ups";
  }
  
  // FedEx: 12-14 digits or 22 digits
  if (/^\d{12,14}$/.test(trackingNumber) || /^\d{22}$/.test(trackingNumber)) {
    return "fedex";
  }
  
  return "usps"; // Default to USPS for Etsy sellers
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
