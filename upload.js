/**
 * Secure file upload configuration.
 *
 * Files live OUTSIDE the statically served `public/` directory and are only
 * released through an authorised API endpoint, so private addresses, phone
 * numbers and evidence are never publicly downloadable (Phase 3 / Phase 12).
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_ROOT = process.env.VERCEL
  ? path.join("/tmp", "uploads") // Vercel: only /tmp is writable (temporary)
  : path.join(__dirname, "uploads");
const SUBDIRS = ["evidence", "resolution", "documents"];

for (const dir of [UPLOAD_ROOT, ...SUBDIRS.map((d) => path.join(UPLOAD_ROOT, d))]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const EXTENSION_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf"
};

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_ROOT, subdir)),
    filename: (req, file, cb) => {
      const ext =
        EXTENSION_BY_MIME[file.mimetype] ||
        path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "") ||
        ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    }
  });
}

function buildUploader(subdir, allowedTypes, maxBytes) {
  return multer({
    storage: makeStorage(subdir),
    limits: { fileSize: maxBytes, files: 6 },
    fileFilter: (req, file, cb) => {
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
      cb(null, true);
    }
  });
}

const evidenceUploader = buildUploader(
  "evidence",
  [...IMAGE_TYPES, ...VIDEO_TYPES],
  MAX_VIDEO_BYTES
);
const resolutionUploader = buildUploader(
  "resolution",
  [...IMAGE_TYPES, ...VIDEO_TYPES],
  MAX_VIDEO_BYTES
);
const documentUploader = buildUploader("documents", DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);

/** Multer middleware honouring the requested WeakMap order, with tagging. */
function withTagging(uploader, subdir) {
  const handler = uploader.fields([
    { name: "image", maxCount: 3 },
    { name: "video", maxCount: 2 },
    { name: "documents", maxCount: 5 }
  ]);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (err) return next(err);
      const files = req.files || {};
      for (const value of Object.values(files)) {
        for (const file of value) file.publicPath = `${subdir}/${file.filename}`;
      }
      next();
    });
}

const uploadComplaintEvidence = withTagging(evidenceUploader, "evidence");
const uploadResolutionEvidence = withTagging(resolutionUploader, "resolution");
const uploadApplicationDocuments = withTagging(documentUploader, "documents");

/** Rejects files that pass multer's global limit but exceed their type budget. */
function validateMediaSizes(req, res, next) {
  const files = req.files || {};
  const all = [];
  for (const value of Object.values(files)) if (Array.isArray(value)) all.push(...value);
  for (const file of all) {
    if (file.mimetype.startsWith("video/") && file.size > MAX_VIDEO_BYTES) {
      return res.status(413).json({ error: "Video files must be 25 MB or smaller" });
    }
    if (file.mimetype.startsWith("image/") && file.size > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Images must be 8 MB or smaller" });
    }
    if (file.mimetype === "application/pdf" && file.size > MAX_DOCUMENT_BYTES) {
      return res.status(413).json({ error: "Documents must be 10 MB or smaller" });
    }
  }
  next();
}

/** Removes uploaded files from disk. Used when a request fails validation. */
function cleanupUploads(req) {
  const files = req.files || {};
  const all = [];
  for (const value of Object.values(files)) if (Array.isArray(value)) all.push(...value);
  for (const file of all) {
    fs.unlink(file.path, () => {});
  }
}

/** Resolves a stored relative path to an absolute path inside UPLOAD_ROOT. */
function resolveStoredPath(storedPath) {
  if (!storedPath) return null;
  const cleaned = String(storedPath).replace(/^\/?uploads\/?/, "");
  const absolute = path.resolve(UPLOAD_ROOT, cleaned);
  if (!absolute.startsWith(UPLOAD_ROOT)) return null; // guard path traversal
  return fs.existsSync(absolute) ? absolute : null;
}

module.exports = {
  UPLOAD_ROOT,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCUMENT_BYTES,
  IMAGE_TYPES,
  VIDEO_TYPES,
  DOCUMENT_TYPES,
  uploadComplaintEvidence,
  uploadResolutionEvidence,
  uploadApplicationDocuments,
  validateMediaSizes,
  cleanupUploads,
  resolveStoredPath
};
