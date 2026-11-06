/**
 * Authentication / authorisation middleware.
 *
 * Roles in this system: 'user' (citizen), 'staff', 'admin'.
 * Staff and admin can manage complaints; only admin can change system
 * configuration, manage staff accounts or export reports.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
const STAFF_ROLES = ["staff", "admin"];

/** Wraps an async route handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function readToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Rejects the request when no valid bearer token is present. */
function authMiddleware(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });
  req.user = payload;
  next();
}

/** Attaches req.user when a valid token is supplied, but never rejects. */
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

/**
 * Role guard. Also performs authentication when it runs before any auth
 * middleware (e.g. mounted at router level), so `router.use(requireAdmin)`
 * works standalone.
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      const token = readToken(req);
      const payload = token ? verifyToken(token) : null;
      if (!payload) return res.status(401).json({ error: "Authentication required" });
      req.user = payload;
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

const requireStaff = requireRole(STAFF_ROLES);
const requireAdmin = requireRole(["admin"]);

function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

module.exports = {
  asyncHandler,
  authMiddleware,
  optionalAuth,
  requireStaff,
  requireAdmin,
  isStaff,
  signToken,
  JWT_SECRET,
  STAFF_ROLES
};
