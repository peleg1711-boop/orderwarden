const trimString = (value) => (typeof value === "string" ? value.trim() : value);

const validateOrderCheck = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const orderId = trimString(payload.orderId);
  const trackingNumber = trimString(payload.trackingNumber);
  const carrier = trimString(payload.carrier);

  if (!orderId) {
    return { ok: false, error: "orderId is required and must be a non-empty string." };
  }

  if (!trackingNumber) {
    return {
      ok: false,
      error: "trackingNumber is required and must be a non-empty string."
    };
  }

  if (carrier && typeof carrier !== "string") {
    return { ok: false, error: "carrier must be a string when provided." };
  }

  return {
    ok: true,
    value: {
      orderId,
      trackingNumber,
      carrier: carrier || null
    }
  };
};

const validateOrderCreate = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const storeId = trimString(payload.storeId);
  const orderId = trimString(payload.orderId);
  const trackingNumber = trimString(payload.trackingNumber);
  const carrier = trimString(payload.carrier);

  if (!storeId) {
    return { ok: false, error: "storeId is required and must be a non-empty string." };
  }

  if (!orderId) {
    return { ok: false, error: "orderId is required and must be a non-empty string." };
  }

  if (!trackingNumber) {
    return {
      ok: false,
      error: "trackingNumber is required and must be a non-empty string."
    };
  }

  if (carrier && typeof carrier !== "string") {
    return { ok: false, error: "carrier must be a string when provided." };
  }

  return {
    ok: true,
    value: {
      storeId,
      orderId,
      trackingNumber,
      carrier: carrier || null
    }
  };
};

const validateOrderList = (query) => {
  const storeId = trimString(query?.storeId);

  if (!storeId) {
    return { ok: false, error: "storeId query parameter is required." };
  }

  return { ok: true, value: { storeId } };
};

module.exports = {
  validateOrderCheck,
  validateOrderCreate,
  validateOrderList
};
