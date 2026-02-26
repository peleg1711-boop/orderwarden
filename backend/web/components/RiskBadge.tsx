type RiskBadgeProps = {
  riskLevel?: string;
};

const getRiskClass = (riskLevel?: string) => {
  switch (riskLevel) {
    case "high":
      return "risk risk-high";
    case "medium":
      return "risk risk-medium";
    case "low":
      return "risk risk-low";
    default:
      return "risk risk-unknown";
  }
};

const RiskBadge = ({ riskLevel }: RiskBadgeProps) => {
  const label = riskLevel ? riskLevel.replace(/_/g, " ") : "unknown";
  return <span className={getRiskClass(riskLevel)}>{label}</span>;
};

export default RiskBadge;
