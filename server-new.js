try { require("dotenv").config(); } catch (e) {}
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const { supabase, supabaseAdmin, initializeDatabase, createAuditLog, createNotification } = require("./supabase");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
});

app.use("/api/auth", authLimiter);
app.use("/api", limiter);

// File upload configuration
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  },
});

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

// Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !["admin", "staff"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Auth routes
app.post(
  "/api/auth/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes("already registered") || authError.code === "email_exists") {
          return res.status(409).json({ error: "Email already registered" });
        }
        console.error("Auth creation error:", authError);
        return res.status(400).json({ error: authError.message || "Failed to create account" });
      }

      // Create user record in public.users
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .insert({
          auth_id: authData.user.id,
          name,
          email: email.toLowerCase(),
          role: "user",
        })
        .select()
        .single();

      if (userError) throw userError;

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      };

      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

      await createAuditLog(userData.id, "user_registered", "user", userData.id, null, user, req);

      res.json({ token, user });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ error: "Failed to register user" });
    }
  }
);

app.post(
  "/api/auth/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Get user details from public.users
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("auth_id", authData.user.id)
        .single();

      if (userError || !userData) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      };

      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

      await createAuditLog(userData.id, "user_login", "user", userData.id, null, null, req);

      res.json({ token, user });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  }
);

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role, phone, address, created_at")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    res.json({ user: data });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// Complaint routes
app.post(
  "/api/complaints",
  authMiddleware,
  upload.single("image"),
  [
    body("category").trim().notEmpty(),
    body("title").optional().trim(),
    body("description").trim().notEmpty(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { category, description, latitude, longitude, location_text, priority } = req.body;
      const title = req.body.title || `${category} complaint`;
      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

      const { data, error } = await supabaseAdmin
        .from("complaints")
        .insert({
          user_id: req.user.id,
          category,
          title,
          description,
          image_path: imagePath,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          location_text: location_text || null,
          priority: priority || "medium",
          status: "Pending",
        })
        .select()
        .single();

      if (error) throw error;

      await createNotification(
        req.user.id,
        data.id,
        "complaint_submitted",
        "Complaint Submitted",
        `Your complaint #${data.complaint_number} has been submitted successfully.`
      );

      await createAuditLog(req.user.id, "complaint_created", "complaint", data.id, null, data, req);

      res.status(201).json(data);
    } catch (err) {
      console.error("Create complaint error:", err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  }
);

// Statistics route MUST come before /:id route
app.get("/api/complaints/stats", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: stats, error: statsError } = await supabaseAdmin
      .from("complaint_statistics")
      .select("*")
      .single();

    if (statsError) throw statsError;

    const { data: byCategory, error: categoryError } = await supabaseAdmin
      .from("complaints")
      .select("category")
      .then(({ data }) => {
        const counts = {};
        data?.forEach(c => {
          counts[c.category] = (counts[c.category] || 0) + 1;
        });
        return { data: Object.entries(counts).map(([category, count]) => ({ category, count })) };
      });

    const byStatus = [
      { status: 'Pending', count: stats.pending_count || 0 },
      { status: 'In Progress', count: stats.in_progress_count || 0 },
      { status: 'Resolved', count: stats.resolved_count || 0 },
      { status: 'Rejected', count: stats.rejected_count || 0 },
    ];

    res.json({
      ...stats,
      byStatus: byStatus,
      byCategory: byCategory || [],
      byMonth: [],
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to load statistics" });
  }
});

app.get("/api/complaints", authMiddleware, async (req, res) => {
  try {
    const { status, category, priority } = req.query;
    const isAdmin = ["admin", "staff"].includes(req.user.role);

    let query = supabaseAdmin
      .from("complaints")
      .select(`
        *,
        user:users!complaints_user_id_fkey(name, email)
      `)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", req.user.id);
    }

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (priority) query = query.eq("priority", priority);

    const { data, error } = await query;

    if (error) throw error;

    // Flatten user data
    const complaints = data.map(c => ({
      ...c,
      user_name: c.user?.name || "Unknown",
      user_email: c.user?.email || "",
    }));

    res.json(complaints);
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ error: "Failed to load complaints" });
  }
});

app.get("/api/complaints/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = ["admin", "staff"].includes(req.user.role);

    let query = supabaseAdmin
      .from("complaints")
      .select(`
        *,
        user:users!complaints_user_id_fkey(name, email),
        assigned_user:users!complaints_assigned_to_fkey(name, email),
        comments:complaint_comments(*, user:users(name, email))
      `)
      .eq("id", id)
      .single();

    const { data, error } = await query;

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Check access
    if (!isAdmin && data.user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Flatten data
    const complaint = {
      ...data,
      user_name: data.user?.name || "Unknown",
      user_email: data.user?.email || "",
      assigned_to_name: data.assigned_user?.name || null,
      assigned_to_email: data.assigned_user?.email || null,
    };

    res.json(complaint);
  } catch (err) {
    console.error("Get complaint error:", err);
    res.status(500).json({ error: "Failed to load complaint" });
  }
});

app.patch(
  "/api/complaints/:id",
  authMiddleware,
  requireAdmin,
  [
    body("status").optional().isIn(["Pending", "In Progress", "Resolved", "Rejected", "Closed"]),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assigned_to, admin_remarks, resolution_notes, priority, estimated_resolution_date } = req.body;

      // Get existing complaint
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from("complaints")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const updates = {};
      if (status !== undefined) updates.status = status;
      if (assigned_to !== undefined && assigned_to !== "") updates.assigned_to = assigned_to;
      if (assigned_to === "") updates.assigned_to = null; // Clear assignment
      if (admin_remarks !== undefined) updates.admin_remarks = admin_remarks;
      if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
      if (priority !== undefined) updates.priority = priority;
      if (estimated_resolution_date !== undefined) updates.estimated_resolution_date = estimated_resolution_date;

      if (status === "Resolved" && !existing.actual_resolution_date) {
        updates.actual_resolution_date = new Date().toISOString();
      }

      if (assigned_to && !existing.assigned_at) {
        updates.assigned_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from("complaints")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create status history
      if (status && existing.status !== status) {
        await supabaseAdmin
          .from("complaint_status_history")
          .insert({
            complaint_id: id,
            old_status: existing.status,
            new_status: status,
            changed_by: req.user.id,
            changed_by_email: req.user.email,
            remarks: admin_remarks,
          });

        await createNotification(
          existing.user_id,
          id,
          "status_changed",
          "Status Updated",
          `Your complaint #${existing.complaint_number} status has been updated to ${status}.`
        );
      }

      await createAuditLog(req.user.id, "complaint_updated", "complaint", id, existing, updates, req);

      res.json(data);
    } catch (err) {
      console.error("Update complaint error:", err);
      res.status(500).json({ error: "Failed to update complaint" });
    }
  }
);

// Statistics overview (keep for backward compatibility)
app.get("/api/complaints/stats/overview", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: stats, error: statsError } = await supabaseAdmin
      .from("complaint_statistics")
      .select("*")
      .single();

    if (statsError) throw statsError;

    const { data: byCategory, error: categoryError } = await supabaseAdmin
      .from("complaints")
      .select("category")
      .then(({ data }) => {
        const counts = {};
        data?.forEach(c => {
          counts[c.category] = (counts[c.category] || 0) + 1;
        });
        return { data: Object.entries(counts).map(([category, count]) => ({ category, count })) };
      });

    const byStatus = [
      { status: 'Pending', count: stats.pending_count || 0 },
      { status: 'In Progress', count: stats.in_progress_count || 0 },
      { status: 'Resolved', count: stats.resolved_count || 0 },
      { status: 'Rejected', count: stats.rejected_count || 0 },
    ];

    res.json({
      ...stats,
      byStatus: byStatus,
      byCategory: byCategory || [],
      byMonth: [],
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to load statistics" });
  }
});

// Public overview
app.get("/api/public/overview", async (req, res) => {
  try {
    const { data: byStatus, error: statusError } = await supabase
      .from("complaints")
      .select("status")
      .eq("is_public", true);

    if (statusError) throw statusError;

    const statusCounts = {};
    byStatus.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const byStatusArray = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    const { data: recentResolved, error: resolvedError } = await supabase
      .from("complaints")
      .select("*")
      .eq("status", "Resolved")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(12);

    if (resolvedError) throw resolvedError;

    res.json({
      byStatus: byStatusArray,
      recentResolved: recentResolved || [],
      byMonthTotal: [],
      byMonthResolved: [],
    });
  } catch (err) {
    console.error("Public overview error:", err);
    res.status(500).json({ error: "Failed to load public stats" });
  }
});

// User management
app.get("/api/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

app.patch(
  "/api/users/:id",
  authMiddleware,
  requireAdmin,
  [body("role").isIn(["user", "admin", "staff"])],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ role })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await createAuditLog(req.user.id, "user_role_updated", "user", id, null, { role }, req);

      res.json(data);
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

// Notifications
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

app.post("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Departments
app.get("/api/departments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Get departments error:", err);
    res.status(500).json({ error: "Failed to load departments" });
  }
});

// Categories
app.get("/api/categories", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("complaint_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// Fallback route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Initialize and start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n✓ Municipal portal server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`✓ Supabase connected: ${process.env.SUPABASE_URL ? "Yes" : "No"}`);
      console.log(`\nDefault admin login:`);
      console.log(`  Email: ${process.env.ADMIN_EMAIL || "admin@municipal.local"}`);
      console.log(`  Password: ${process.env.ADMIN_PASSWORD || "Admin@123"}\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
