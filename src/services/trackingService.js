// services/trackingService.js
// AfterShip integration - FIXED VERSION

const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;
const AFTERSHIP_API_URL = 'https://api.aftership.com/v4';

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
    
    // First, create the tracking (AfterShip will return existing if already created)
    let trackingData;
    try {
      trackingData = await createTracking(trackingNumber, detectedCarrier);
      console.log('[TrackingService] Tracking created/found in AfterShip');
    } catch (createError) {
      // If creation fails, try to get existing
      console.log('[TrackingService] Create failed, trying to get existing tracking');
      trackingData = await getTracking(trackingNumber, detectedCarrier);
    }
    
    // Normalize the AfterShip response
    const normalized = normalizeAfterShipData(trackingData);
    
    console.log(`[TrackingService] Result - Status: ${normalized.status}, Risk: ${normalized.riskLevel}`);
    
    return normalized;
    
  } catch (error) {
    console.error(`[TrackingService] Error checking ${trackingNumber}:`, error.message);
    
    // Return safe fallback with the error info
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
 * Create new tracking in AfterShip
 */
async function createTracking(trackingNumber, carrierSlug = null) {
  const body = {
    tracking: {
      tracking_number: trackingNumber
    }
  };
  
  // Add carrier if detected
  if (carrierSlug) {
    body.tracking.slug = carrierSlug;
  }
  
  console.log(`[TrackingService] Creating tracking in AfterShip:`, JSON.stringify(body));
  
  const response = await fetch(`${AFTERSHIP_API_URL}/trackings`, {
    method: 'POST',
    headers: {
      'aftership-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('[TrackingService] AfterShip create error:', data);
    
    // If tracking already exists, that's fine - try to get it
    if (data.meta?.code === 4003) {
      console.log('[TrackingService] Tracking already exists, will fetch it');
      return getTracking(trackingNumber, carrierSlug);
    }
    
    throw new Error(data.meta?.message || 'Failed to create tracking');
  }
  
  console.log('[TrackingService] AfterShip response:', JSON.stringify(data.data?.tracking));
  return data.data.tracking;
}

/**
 * Get existing tracking from AfterShip
 */
async function getTracking(trackingNumber, carrierSlug = null) {
  // Build URL - need both slug and tracking number
  const slug = carrierSlug || 'usps'; // Default to USPS if not provided
  const url = `${AFTERSHIP_API_URL}/trackings/${slug}/${trackingNumber}`;
  
  console.log(`[TrackingService] Getting tracking from: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'aftership-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('[TrackingService] AfterShip get error:', data);
    throw new Error(data.meta?.message || 'Failed to get tracking');
  }
  
  return data.data.tracking;
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
    if (latestCheckpoint.country_iso3) parts.push(latestCheckpoint.country_iso3);
    location = parts.join(', ') || null;
  }
  
  return {
    status,
    riskLevel,
    carrier: tracking.slug || 'unknown',
    lastUpdate,
    location,
    message: latestCheckpoint?.message || latestCheckpoint?.subtag_message || null,
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
    
    // No update in 72+ hours = red
    if (hoursSinceUpdate > 72) {
      return "red";
    }
    
    // No update in 48+ hours = yellow
    if (hoursSinceUpdate > 48) {
      return "yellow";
    }
  }
  
  // Pre-transit for more than 48 hours
  if (normalizedStatus === "pre_transit") {
    const hoursSinceUpdate = (Date.now() - new Date(lastUpdateTime)) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 48) {
      return "yellow";
    }
  }
  
  // Unknown status
  if (normalizedStatus === "unknown") {
    return "yellow";
  }
  
  // Default to green for normal in_transit
  return "green";
}

/**
 * Normalize carrier name to AfterShip slug
 */
function normalizeCarrierSlug(carrier) {
  if (!carrier) return null;
  
  const slugMap = {
    'USPS': 'usps',
    'UPS': 'ups',
    'FEDEX': 'fedex',
    'FedEx': 'fedex',
    'DHL': 'dhl-express',
    'DHL Express': 'dhl-express',
    'Amazon': 'amazon'
  };
  
  return slugMap[carrier] || carrier.toLowerCase();
}

/**
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber) {
  if (!trackingNumber) return null;
  
  // USPS: 20-22 digits or specific formats
  if (/^\d{20,22}$/.test(trackingNumber) || /^(94|92|93|95)\d{20}$/.test(trackingNumber)) {
    return "usps";
  }
  
  // UPS: 1Z followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/i.test(trackingNumber)) {
    return "ups";
  }
  
  // FedEx: 12-14 digits
  if (/^\d{12,14}$/.test(trackingNumber)) {
    return "fedex";
  }
  
  // Default to USPS for unrecognized formats (most common for Etsy)
  return "usps";
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
    location: "Los Angeles, CA",
    message: "Package is in transit",
    deliveryDate: null
  };
}

module.exports = {
  checkTrackingStatus,
  calculateRiskLevel,
  detectCarrier,
  normalizeCarrierSlug
};
