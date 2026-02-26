// utils/messageTemplates.js
// Generates ready-to-send messages for Etsy sellers to send to buyers

function getMessageTemplate(status, riskLevel, orderId) {
  // Normalize inputs
  const normalizedStatus = (status || "unknown").toLowerCase();
  const normalizedRisk = (riskLevel || "green").toLowerCase();
  
  // High risk scenarios - urgent messages
  if (normalizedRisk === "red") {
    if (normalizedStatus === "exception" || normalizedStatus === "delivery_failed") {
      return {
        subject: `Important update about your order ${orderId}`,
        message: `Hi there! I wanted to reach out about your order ${orderId}. The tracking shows there's been a delivery issue. I'm actively working with the carrier to resolve this and will send you an update within 24 hours. Your satisfaction is my priority!`,
        tone: "urgent",
        copyable: true
      };
    }
    
    if (normalizedStatus === "lost" || normalizedStatus === "unknown") {
      return {
        subject: `Quick check-in about your order ${orderId}`,
        message: `Hi! I noticed the tracking for your order ${orderId} hasn't updated in a while. I'm checking with the carrier now. If we don't see movement in the next 48 hours, I'll send a replacement right away. Thanks for your patience!`,
        tone: "urgent",
        copyable: true
      };
    }
  }
  
  // Yellow risk - proactive but calm
  if (normalizedRisk === "yellow") {
    if (normalizedStatus === "in_transit" || normalizedStatus === "pre_transit") {
      return {
        subject: `Your order ${orderId} is on its way!`,
        message: `Hi! Just wanted to give you a quick update - your order ${orderId} is in transit but running a bit slower than usual. Carriers are experiencing some delays, but your package is moving. I'm keeping an eye on it and will update you if anything changes!`,
        tone: "reassuring",
        copyable: true
      };
    }
  }
  
  // Green/normal scenarios
  if (normalizedStatus === "delivered") {
    return {
      subject: `Your order ${orderId} has been delivered!`,
      message: `Great news! Your order ${orderId} shows as delivered. I hope you love it! If you have any questions or concerns, please don't hesitate to reach out. I'd really appreciate it if you could leave a review when you get a chance. Thanks for your order!`,
      tone: "positive",
      copyable: true
    };
  }
  
  if (normalizedStatus === "out_for_delivery") {
    return {
      subject: `Your order ${orderId} is out for delivery today!`,
      message: `Exciting news! Your order ${orderId} is out for delivery and should arrive today. Keep an eye out for the carrier. If you have any questions, I'm here to help!`,
      tone: "positive",
      copyable: true
    };
  }
  
  if (normalizedStatus === "in_transit") {
    return {
      subject: `Your order ${orderId} is on the way!`,
      message: `Hi! Your order ${orderId} is in transit and making good progress. You can expect it to arrive soon. I'm tracking it closely and will let you know if there are any updates. Thanks for your order!`,
      tone: "neutral",
      copyable: true
    };
  }
  
  // Default/fallback
  return {
    subject: `Update on your order ${orderId}`,
    message: `Hi! I wanted to check in about your order ${orderId}. I'm monitoring the tracking and will keep you posted on any updates. If you have any questions, feel free to reach out anytime!`,
    tone: "neutral",
    copyable: true
  };
}

// Helper to get just the message text (without metadata)
function getMessageText(status, riskLevel, orderId) {
  const template = getMessageTemplate(status, riskLevel, orderId);
  return template.message;
}

// Helper to get message with subject line for email
function getFullMessage(status, riskLevel, orderId) {
  const template = getMessageTemplate(status, riskLevel, orderId);
  return {
    subject: template.subject,
    body: template.message
  };
}

module.exports = {
  getMessageTemplate,
  getMessageText,
  getFullMessage
};
