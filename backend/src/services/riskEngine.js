function calculateRisk({ status, lastUpdateAt }) {
  const now = Date.now();
  const lastUpdate = lastUpdateAt ? new Date(lastUpdateAt).getTime() : null;

  if (!status) return "yellow";

  const normalized = String(status).toLowerCase();

  if (normalized.includes("delivered")) return "green";
  if (normalized.includes("exception")) return "red";
  if (normalized.includes("failed")) return "red";

  if (lastUpdate) {
    const days = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    if (days > 14) return "red";
    if (days > 5) return "yellow";
  }

  return "green";
}

module.exports = { calculateRisk };
