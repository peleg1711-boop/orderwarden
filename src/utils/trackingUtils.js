const detectCarrier = (trackingNumber) => {
  const value = trackingNumber.replace(/\s+/g, "");

  if (/^1Z[0-9A-Z]{16}$/i.test(value)) {
    return "ups";
  }

  if (/^\d{20,22}$/.test(value)) {
    return "usps";
  }

  if (/^\d{12}$/.test(value) || /^\d{15}$/.test(value)) {
    return "fedex";
  }

  if (/^\d{10}$/.test(value) && value.startsWith("3")) {
    return "dhl";
  }

  return "unknown";
};

module.exports = {
  detectCarrier
};
