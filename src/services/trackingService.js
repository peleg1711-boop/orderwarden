// services/trackingService.js
// Handles communication with tracking APIs and normalizes responses

/**
 * Check tracking status for a package
 * @param {string} trackingNumber - The tracking number
 * @param {string} carrier - Optional carrier (USPS, UPS, FedEx, etc.)
 * @returns {Promise<Object>} Normalized tracking result
 */
async function checkTrackingStatus(trackingNumber, carrier = null) {
  console.log(`[TrackingService] Checking ${trackingNumber} (carrier: ${carrier || "auto-detect"})`);
  
  try {
    // TODO: Implement actual carrier API calls
    // For now, return mock data structure
    
    // In production, you'd call:
    // - EasyPost API
    // - AfterShip API
    // - Direct carrier APIs (USPS, UPS, FedEx)
    
    const mockResult = await fetchTrackingData(trackingNumber, carrier);
    
    // Normalize the carrier response to our standard format
    const normalized = normalizeTrackingData(mockResult, trackingNumber);
    
    console.log(`[TrackingService] Result - Status: ${normalized.status}, Risk: ${normalized.riskLevel}`);
    
    return normalized;
    
  } catch (error) {
    console.error(`[TrackingService] Error checking ${trackingNumber}:`, error.message);
    
    // Return safe fallback
    return {
      status: "unknown",
      riskLevel: "yellow",
      carrier: carrier || "unknown",
      lastUpdate: new Date(),
      location: null,
      error: error.message
    };
  }
}

/**
 * Mock function - replace with real API call
 */
async function fetchTrackingData(trackingNumber, carrier) {
  // TODO: Replace this with actual API integration
  // Example with EasyPost:
  /*
  const Easypost = require('@easypost/api');
  const client = new Easypost(process.env.EASYPOST_API_KEY);
  const tracker = await client.Tracker.create({ tracking_code: trackingNumber, carrier });
  return tracker;
  */
  
  // For now, simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock data
  return {
    status: "in_transit",
    carrier: carrier || "USPS",
    tracking_details: [
      {
        datetime: new Date().toISOString(),
        message: "Package is in transit",
        status: "in_transit",
        tracking_location: {
          city: "Los Angeles",
          state: "CA"
        }
      }
    ]
  };
}

/**
 * Normalize different carrier response formats to our standard format
 */
function normalizeTrackingData(carrierResponse, trackingNumber) {
  // Standard status values:
  // - pre_transit: Label created but not yet scanned
  // - in_transit: Package is moving
  // - out_for_delivery: Out for delivery today
  // - delivered: Successfully delivered
  // - exception: Delivery exception
  // - delivery_failed: Failed delivery attempt
  // - lost: Package appears lost
  // - unknown: Cannot determine status
  
  const status = carrierResponse.status || "unknown";
  const carrier = carrierResponse.carrier || "unknown";
  
  // Get latest tracking event
  const latestEvent = carrierResponse.tracking_details?.[0] || {};
  
  // Calculate risk level based on status and time
  const riskLevel = calculateRiskLevel(status, latestEvent.datetime);
  
  return {
    status: status.toLowerCase(),
    riskLevel,
    carrier,
    lastUpdate: latestEvent.datetime ? new Date(latestEvent.datetime) : new Date(),
    location: latestEvent.tracking_location 
      ? `${latestEvent.tracking_location.city}, ${latestEvent.tracking_location.state}`
      : null,
    message: latestEvent.message || null
  };
}

/**
 * Calculate risk level based on tracking status and time since last update
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
  if (normalizedStatus === "in_transit" && lastUpdateTime) {
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
  if (normalizedStatus === "pre_transit" && lastUpdateTime) {
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
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber) {
  // USPS: 20-22 digits or specific formats
  if (/^\d{20,22}$/.test(trackingNumber)) {
    return "USPS";
  }
  
  // UPS: 1Z followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/.test(trackingNumber)) {
    return "UPS";
  }
  
  // FedEx: 12-14 digits
  if (/^\d{12,14}$/.test(trackingNumber)) {
    return "FedEx";
  }
  
  return null;
}

module.exports = {
  checkTrackingStatus,
  normalizeTrackingData,
  calculateRiskLevel,
  detectCarrier
};
