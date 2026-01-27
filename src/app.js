// app.js - CORRECTED VERSION
const express = require("express");
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (if needed for frontend)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "OrderGuard API",
    timestamp: new Date().toISOString()
  });
});

// Debug route (optional - can remove in production)
app.get("/debug/env", (req, res) => {
  res.json({
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseHost: process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).host
      : null,
    nodeEnv: process.env.NODE_ENV || "development"
  });
});

// ⚠️ CRITICAL: Routes must be mounted - DO NOT COMMENT OUT
app.use("/api/orders", require("./routes/orders"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not found",
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message
  });
});

module.exports = app;
