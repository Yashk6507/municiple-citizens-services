/**
 * Municipal Citizen Services & Smart Complaint Management System
 * Application entrypoint (SQLite / local deployment).
 *
 * Mounts the modular API routers on top of the schema owned by db.js and serves
 * the single-page frontend from public/.
 */
try {
  require("dotenv").config();
} catch (e) {
  /* dotenv is optional */
}

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const { optionalAuth, JWT_SECRET } = require("./auth-helpers");
const { getSettingNumber } = require("./lib/store");
const { escalateOverdue } = require("./lib/escalation");

const app = express();
const PORT = process.env.PORT || 4000;
const IS_VERCEL = !!process.env.VERCEL;

// ---------------------------------------------------------------------------
// Security + parsing middleware
// ---------------------------------------------------------------------------
app.set("trust proxy", 1);

// On Vercel (serverless) there is no long-running boot step, so make sure the
// database has finished initialising before any request is handled.
if (IS_VERCEL) {
  app.use((req, res, next) => {
    db.ready.then(() => next()).catch(next);
  });
}
app.use(
  helmet({
    // The SPA loads Leaflet/Chart.js from a CDN and uses inline handlers, so a
    // strict default CSP would break the app. Cross-origin resource sharing for
    // images is also relaxed for the same reason.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
  })
);
app.use(cors({ origin: "*" }));

// The Brevo inbound webhook can carry large payloads (quoted messages and
// attachments), so that single path parses its own body with a higher limit.
const jsonParser = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  if (req.path === "/api/email/inbound") return next();
  if (req.path === "/api/payments/webhook") return next(); // raw body for signature verification
  return jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." }
});
// Map tiles are image requests: a single pan or zoom is a batch of them, so they
// are mounted before the API rate limiter and served from a small proxy cache
// (see routes/tiles.js for why a proxy is needed at all).
app.use("/api/map/tiles", require("./routes/tiles"));

app.use("/api", apiLimiter);

// ---------------------------------------------------------------------------
// API routers
// ---------------------------------------------------------------------------
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/complaints", require("./routes/complaints"));
app.use("/api/staff", require("./routes/staff"));
app.use("/api/services", require("./routes/services"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/payments", require("./routes/admin-payments"));
app.use("/api/public", require("./routes/public"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/email", require("./routes/email"));
app.use("/api/payments", require("./routes/payments"));

// ---------------------------------------------------------------------------
// CivilBot (the portal's built-in civic assistant)
//
// Answers are composed from the portal's own reference data by lib/civilbot.js,
// so the assistant works with no API key. A real ANTHROPIC_API_KEY upgrades the
// wording via Claude; CivilBot remains the fallback.
// ---------------------------------------------------------------------------
const aiService = require("./ai-service");

app.post("/api/chatbot", optionalAuth, async (req, res) => {
  try {
    const { message, conversationHistory, action, actionData } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await aiService.getChatbotResponse(message, conversationHistory || [], {
      user: req.user || null,
      action: action,
      actionData: actionData
    });

    if (req.user && req.user.id) {
      db.run(
        "INSERT INTO chatbot_conversations (user_id, message, response) VALUES (?, ?, ?)",
        [req.user.id, String(message).slice(0, 2000), result.response],
        (err) => {
          if (err) console.error("Failed to save CivilBot conversation:", err.message);
        }
      );
    }
    res.json(result);
  } catch (err) {
    console.error("CivilBot error:", err.message);
    res.status(500).json({
      error: "CivilBot is unavailable",
      response:
        "I could not answer that just now. Please try again, or open the Complaints section to file or track your complaint directly."
    });
  }
});

// Enhanced chatbot endpoint with context about user's data
app.post("/api/chatbot/enhanced", optionalAuth, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get user's recent activity for context
    let userContext = {};
    if (req.user?.id) {
      const [recentComplaints, recentApplications, pendingBills] = await Promise.all([
        new Promise((resolve) => {
          db.all(
            `SELECT c.reference_no, c.title, c.status, c.priority, c.due_at, c.created_at
             FROM complaints c
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC LIMIT 3`,
            [req.user.id],
            (err, rows) => resolve(err ? [] : rows || [])
          );
        }),
        new Promise((resolve) => {
          db.all(
            `SELECT a.reference_no, a.subcategory_name, a.status, a.created_at
             FROM applications a
             WHERE a.user_id = ?
             ORDER BY a.created_at DESC LIMIT 3`,
            [req.user.id],
            (err, rows) => resolve(err ? [] : rows || [])
          );
        }),
        new Promise((resolve) => {
          db.all(
            `SELECT b.reference_no, b.bill_type, b.amount, b.due_date, b.status
             FROM bills b
             WHERE b.user_id = ? AND b.status = 'pending'
             ORDER BY b.due_date ASC LIMIT 3`,
            [req.user.id],
            (err, rows) => resolve(err ? [] : rows || [])
          );
        })
      ]);
      userContext = { recentComplaints, recentApplications, pendingBills };
    }

    const result = await aiService.getChatbotResponse(message, conversationHistory || [], {
      user: req.user || null,
      ...userContext
    });

    if (req.user && req.user.id) {
      db.run(
        "INSERT INTO chatbot_conversations (user_id, message, response) VALUES (?, ?, ?)",
        [req.user.id, String(message).slice(0, 2000), result.response],
        (err) => {
          if (err) console.error("Failed to save CivilBot conversation:", err.message);
        }
      );
    }
    res.json({ ...result, userContext });
  } catch (err) {
    console.error("Enhanced CivilBot error:", err.message);
    res.status(500).json({
      error: "CivilBot is unavailable",
      response: "I could not answer that just now. Please try again."
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
const publicDir = path.join(__dirname, "public");
app.use(
  express.static(publicDir, {
    index: "index.html",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    }
  })
);

// Unmatched API routes return JSON, never the SPA shell.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// SPA fallback for client-side navigation.
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---------------------------------------------------------------------------
// Error handling (validation, upload and unexpected errors)
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "The uploaded file is too large" });
  }
  if (err && err.code && String(err.code).startsWith("LIMIT_")) {
    return res.status(400).json({ error: "Too many files were uploaded" });
  }
  if (err && /Unsupported file type/i.test(err.message || "")) {
    return res.status(415).json({ error: err.message });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The request body could not be parsed" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "The request body is too large" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected server error occurred" });
});

// ---------------------------------------------------------------------------
// Scheduled SLA escalation sweep (Phase 7)
// ---------------------------------------------------------------------------
async function scheduleEscalationSweep() {
  const minutes = await getSettingNumber("escalation_interval_minutes", 60);
  const intervalMs = Math.max(5, minutes) * 60 * 1000;
  const runSweep = async () => {
    try {
      const result = await escalateOverdue({ actor: null });
      if (result && result.escalated && result.escalated.length) {
        console.log(`Escalation sweep: ${result.escalated.length} complaint(s) escalated.`);
      }
    } catch (err) {
      console.error("Escalation sweep failed:", err.message);
    }
  };
  // First sweep shortly after boot, then on the configured interval.
  setTimeout(runSweep, 30 * 1000);
  setInterval(runSweep, intervalMs);
  console.log(`Escalation sweep scheduled every ${Math.max(5, minutes)} minute(s).`);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
// Vercel runs this file as a serverless function (see api/index.js), so it must
// not call app.listen() or start timers there. Run the long-lived server and the
// escalation sweep only for local / traditional hosting.
if (!IS_VERCEL) {
  db.ready
    .then(async () => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Municipal portal listening on http://localhost:${PORT}`);
        console.log(
          `Admin login: ${process.env.ADMIN_EMAIL || "admin@municipal.local"} (password from ADMIN_PASSWORD)`
        );
        console.log(`JWT secret source: ${process.env.JWT_SECRET ? "environment" : "development default"}`);
      });
      scheduleEscalationSweep();
    })
    .catch((err) => {
      console.error("Cannot start server: database initialisation failed.", err);
      process.exit(1);
    });

}

module.exports = app;
module.exports.JWT_SECRET = JWT_SECRET;
