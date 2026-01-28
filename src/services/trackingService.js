// services/trackingService.js
// AfterShip integration for real tracking data

const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;
const AFTERSHIP_API_URL = 'https://api.aftership.com/v4';

/**
 * Check tracking status for a package using AfterShip
 * @param {string} trackingNumber - The tracking number
 * @param {string} carrier - Optional carrier slug (usps, ups, fedex, etc.)
 * @returns {Promise<Object>} Normalized tracking result
 */
async function checkTrackingStatus(trackingNumber, carrier = null) {
  console.log(`[TrackingService] Checking ${trackingNumber} (carrier: ${carrier || "auto-detect"})`);
  
  try {
    // If no API key, fall back to mock data
    if (!AFTERSHIP_API_KEY) {
      console.warn('[TrackingService] No AfterShip API key - using mock data');
      return getMockTrackingData(trackingNumber, carrier);
    }
    
    // First, try to get existing tracking or create new one
    let trackingData;
    
    try {
      // Try to get existing tracking
      trackingData = await getTracking(trackingNumber, carrier);
    } catch (error) {
      if (error.statusCode === 404) {
        // Tracking doesn't exist, create it
        console.log('[TrackingService] Creating new tracking in AfterShip');
        trackingData = await createTracking(trackingNumber, carrier);
      } else {
        throw error;
      }
    }
    
    // Normalize the AfterShip response to our standard format
    const normalized = normalizeAfterShipData(trackingData);
    
    console.log(`[TrackingService] Result - Status: ${normalized.status}, Risk: ${normalized.riskLevel}`);
    
    return normalized;
    
  } catch (error) {
    console.error(`[TrackingService] Error checking ${trackingNumber}:`, error.message);
    
    // Return safe fallback
    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: carrier || detectCarrier(trackingNumber) || "unknown",
      lastUpdate: new Date(),
      location: null,
      error: error.message
    };
  }
}

/**
 * Get tracking from AfterShip
 */
async function getTracking(trackingNumber, carrier = null) {
  const slug = carrier ? normalizeCarrierSlug(carrier) : null;
  const url = slug 
    ? `${AFTERSHIP_API_URL}/trackings/${slug}/${trackingNumber}`
    : `${AFTERSHIP_API_URL}/trackings/${trackingNumber}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'aftership-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.meta?.message || 'AfterShip API error');
    err.statusCode = response.status;
    throw err;
  }
  
  const data = await response.json();
  return data.data.tracking;
}

/**
 * Create new tracking in AfterShip
 */
async function createTracking(trackingNumber, carrier = null) {
  const body = {
    tracking: {
      tracking_number: trackingNumber
    }
  };
  
  // Add carrier if provided
  if (carrier) {
    body.tracking.slug = normalizeCarrierSlug(carrier);
  }
  
  const response = await fetch(`${AFTERSHIP_API_URL}/trackings`, {
    method: 'POST',
    headers: {
      'aftership-api-key': AFTERSHIP_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.meta?.message || 'Failed to create tracking');
  }
  
  const data = await response.json();
  return data.data.tracking;
}

/**
 * Normalize AfterShip response to our standard format
 */
function normalizeAfterShipData(tracking) {
  // AfterShip tag to our status mapping
  const statusMap = {
    'Pending': 'pre_transit',
    'InfoReceived': 'pre_transit',
    'InTransit': 'in_transit',
    'OutForDelivery': 'out_for_delivery',
    'AttemptFail': 'delivery_failed',
    'Delivered': 'delivered',
    'Exception': 'exception',
    'Expired': 'lost'
  };
  
  const aftershipTag = tracking.tag || 'Pending';
  const status = statusMap[aftershipTag] || 'unknown';
  
  // Get latest checkpoint
  const latestCheckpoint = tracking.checkpoints?.[0] || null;
  const lastUpdate = latestCheckpoint?.checkpoint_time 
    ? new Date(latestCheckpoint.checkpoint_time)
    : new Date(tracking.created_at);
  
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
  const slugMap = {
    'USPS': 'usps',
    'UPS': 'ups',
    'FEDEX': 'fedex',
    'FedEx': 'fedex',
    'DHL': 'dhl',
    'DHL Express': 'dhl',
    'Amazon': 'amazon'
  };
  
  return slugMap[carrier] || carrier.toLowerCase();
}

/**
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber) {
  // USPS: 20-22 digits or specific formats
  if (/^\d{20,22}$/.test(trackingNumber) || /^(94|92|93|95)\d{20}$/.test(trackingNumber)) {
    return "usps";
  }
  
  // UPS: 1Z followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/.test(trackingNumber)) {
    return "ups";
  }
  
  // FedEx: 12-14 digits
  if (/^\d{12,14}$/.test(trackingNumber)) {
    return "fedex";
  }
  
  return null;
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
