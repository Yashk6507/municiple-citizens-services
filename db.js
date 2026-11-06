const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const { DEPARTMENTS, WARDS, SLA_DEFAULTS, CATEGORIES } = require("./seed-data");

const bundledDbPath = path.join(__dirname, "data", "municipal_portal.db");

// Vercel's filesystem is read-only except /tmp, so copy the bundled database
// there on cold start. NOTE: /tmp is temporary - data written on Vercel is lost
// when the function instance is recycled. Use a hosted DB for persistent data.
let dbPath = bundledDbPath;
if (process.env.VERCEL) {
  dbPath = path.join("/tmp", "municipal_portal.db");
  try {
    if (!fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, dbPath);
    }
  } catch (e) {
    console.error("Could not copy bundled database to /tmp:", e.message);
  }
}

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// ---------------------------------------------------------------------------
// Promise helpers
// ---------------------------------------------------------------------------
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
async function createTables() {
  // ---- existing tables (unchanged definitions, kept for compatibility) ----
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image_path TEXT,
      latitude REAL,
      longitude REAL,
      location_text TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted',
      assigned_to TEXT,
      admin_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      complaint_id INTEGER,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      confidence_score INTEGER,
      issues TEXT,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of_id INTEGER,
      severity_level TEXT,
      priority_recommendation TEXT,
      reasoning TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chatbot_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ---- new reference / configuration tables ----
  await run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS wards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      zone TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'complaint',
      description TEXT,
      is_emergency INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS service_subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'complaint',
      summary TEXT,
      checklist TEXT,
      processing_time TEXT,
      official_url TEXT,
      department_id INTEGER,
      default_priority TEXT NOT NULL DEFAULT 'medium',
      sla_hours INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES service_categories(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority TEXT NOT NULL,
      category_id INTEGER,
      target_hours INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES service_categories(id)
    )
  `);

  // ---- complaint workflow tables ----
  await run(`
    CREATE TABLE IF NOT EXISTS complaint_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'evidence',
      file_path TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      author_id INTEGER,
      author_name TEXT,
      visibility TEXT NOT NULL DEFAULT 'internal',
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      department_id INTEGER,
      assigned_user_id INTEGER,
      method TEXT NOT NULL DEFAULT 'manual',
      note TEXT,
      assigned_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      was_resolved INTEGER NOT NULL DEFAULT 1,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_reopen_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_duplicates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      duplicate_of_id INTEGER NOT NULL,
      similarity REAL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'suggested',
      linked_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (duplicate_of_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      escalated_to TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at DATETIME,
      acknowledged_by TEXT,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      actor_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---- citizen service portal tables ----
  await run(`
    CREATE TABLE IF NOT EXISTS service_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no TEXT,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      subcategory_id INTEGER,
      ward_id INTEGER,
      department_id INTEGER,
      applicant_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted',
      reviewer_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS service_application_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES service_applications(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS service_application_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES service_applications(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS service_application_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES service_applications(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS municipal_offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      office_type TEXT,
      ward_id INTEGER,
      address TEXT,
      phone TEXT,
      email TEXT,
      office_hours TEXT,
      map_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---- email alert log (Brevo outbound + inbound) ----
  await run(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL DEFAULT 'outbound',
      status TEXT NOT NULL DEFAULT 'queued',
      provider_message_id TEXT,
      from_email TEXT,
      from_name TEXT,
      to_email TEXT,
      subject TEXT,
      body TEXT,
      complaint_id INTEGER,
      user_id INTEGER,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---- Bill payment tables ----
  await run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_type TEXT NOT NULL, -- 'electricity', 'water', 'property_tax'
      account_number TEXT NOT NULL, -- consumer number / connection ID / property ID
      bill_number TEXT, -- provider's bill number
      billing_period_start DATE,
      billing_period_end DATE,
      amount_due INTEGER NOT NULL, -- in paise
      amount_paid INTEGER NOT NULL DEFAULT 0, -- in paise
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'cancelled', 'overdue'
      provider_name TEXT, -- e.g., 'TNEB', 'BWSSB', 'Municipal Corporation'
      provider_bill_id TEXT, -- external provider reference
      metadata TEXT, -- JSON for additional fields
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bill_id INTEGER NOT NULL,
      gateway TEXT NOT NULL, -- 'razorpay', 'demo'
      gateway_order_id TEXT NOT NULL,
      amount INTEGER NOT NULL, -- in paise
      currency TEXT NOT NULL DEFAULT 'INR',
      receipt TEXT, -- internal receipt reference
      status TEXT NOT NULL DEFAULT 'created', -- 'created', 'attempted', 'paid', 'failed', 'cancelled'
      notes TEXT, -- JSON metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      UNIQUE(gateway, gateway_order_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bill_id INTEGER NOT NULL,
      payment_order_id INTEGER NOT NULL,
      gateway TEXT NOT NULL,
      gateway_payment_id TEXT,
      gateway_order_id TEXT,
      gateway_signature TEXT,
      amount INTEGER NOT NULL, -- in paise
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'captured', 'failed', 'refunded', 'cancelled'
      method TEXT, -- 'upi', 'card', 'netbanking', 'wallet'
      paid_at DATETIME,
      verified_at DATETIME,
      verified_by TEXT, -- 'webhook', 'manual', 'polling'
      failure_reason TEXT,
      raw_response TEXT, -- JSON from gateway
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id),
      UNIQUE(gateway, gateway_payment_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS payment_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bill_id INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL,
      receipt_number TEXT NOT NULL UNIQUE,
      amount_paid INTEGER NOT NULL, -- in paise
      payment_date DATETIME NOT NULL,
      gateway_transaction_id TEXT,
      bill_category TEXT NOT NULL,
      bill_account_number TEXT NOT NULL,
      bill_number TEXT,
      metadata TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id)
    )
  `);
}

// ---------------------------------------------------------------------------
// Indexes. Created *after* the column migrations, because several of them
// reference columns that are added to pre-existing tables by migration.
// ---------------------------------------------------------------------------
async function createIndexes() {
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)",
    "CREATE INDEX IF NOT EXISTS idx_complaints_dept ON complaints(department_id)",
    "CREATE INDEX IF NOT EXISTS idx_complaints_ward ON complaints(ward_id)",
    "CREATE INDEX IF NOT EXISTS idx_complaints_due ON complaints(due_at)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_ref ON complaints(reference_no)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_client_token ON complaints(user_id, client_token)",
    "CREATE INDEX IF NOT EXISTS idx_subcat_category ON service_subcategories(category_id)",
    "CREATE INDEX IF NOT EXISTS idx_notes_complaint ON complaint_notes(complaint_id)",
    "CREATE INDEX IF NOT EXISTS idx_attach_complaint ON complaint_attachments(complaint_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_complaint ON complaint_status_history(complaint_id)",
    "CREATE INDEX IF NOT EXISTS idx_escalation_open ON complaint_escalations(complaint_id, acknowledged_at)",
    "CREATE INDEX IF NOT EXISTS idx_apps_user ON service_applications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_email_log_direction ON email_log(direction, status)",
    // Bill payment indexes
    "CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status)",
    "CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(service_type)",
    "CREATE INDEX IF NOT EXISTS idx_bills_account ON bills(account_number)",
    "CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(due_date)",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_bill ON payment_orders(bill_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway ON payment_orders(gateway, gateway_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status)",
    "CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_transactions_bill ON payment_transactions(bill_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(payment_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway ON payment_transactions(gateway, gateway_payment_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status)",
    "CREATE INDEX IF NOT EXISTS idx_payment_receipts_user ON payment_receipts(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_receipts_bill ON payment_receipts(bill_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction ON payment_receipts(transaction_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_receipts_number ON payment_receipts(receipt_number)"
  ];
  for (const sql of indexes) {
    await run(sql);
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible column migrations. Existing data is preserved.
// ---------------------------------------------------------------------------
async function addColumnIfMissing(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (columns.some((c) => c.name === column)) return;
  await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function runColumnMigrations() {
  const complaintColumns = [
    ["reference_no", "TEXT"],
    ["title", "TEXT"],
    ["category_id", "INTEGER"],
    ["subcategory_id", "INTEGER"],
    ["ward_id", "INTEGER"],
    ["department_id", "INTEGER"],
    ["priority", "TEXT DEFAULT 'medium'"],
    ["contact_name", "TEXT"],
    ["contact_phone", "TEXT"],
    ["contact_email", "TEXT"],
    ["due_at", "DATETIME"],
    ["resolved_at", "DATETIME"],
    ["closed_at", "DATETIME"],
    ["resolution_notes", "TEXT"],
    ["rejection_reason", "TEXT"],
    ["reopen_count", "INTEGER NOT NULL DEFAULT 0"],
    ["escalation_level", "INTEGER NOT NULL DEFAULT 0"],
    ["is_public", "INTEGER NOT NULL DEFAULT 1"],
    ["assigned_user_id", "INTEGER"],
    ["assigned_at", "DATETIME"],
    ["last_activity_at", "DATETIME"],
    ["client_token", "TEXT"],
    ["citizen_satisfaction_rating", "INTEGER"],
    ["citizen_feedback", "TEXT"]
  ];
  for (const [col, def] of complaintColumns) {
    await addColumnIfMissing("complaints", col, def);
  }

  const userColumns = [
    ["department_id", "INTEGER"],
    ["ward_id", "INTEGER"],
    ["phone", "TEXT"],
    ["address", "TEXT"],
    ["designation", "TEXT"],
    ["is_active", "INTEGER NOT NULL DEFAULT 1"],
    ["last_login_at", "DATETIME"]
  ];
  for (const [col, def] of userColumns) {
    await addColumnIfMissing("users", col, def);
  }

  // Applications gained a map pin so an address can carry coordinates, exactly
  // like a complaint. Older databases are upgraded in place.
  await addColumnIfMissing("service_applications", "latitude", "REAL");
  await addColumnIfMissing("service_applications", "longitude", "REAL");

  // Older databases created complaint_status_history without a remarks column.
  await addColumnIfMissing("complaint_status_history", "remarks", "TEXT");

  // Legacy status normalisation: "Pending" -> "Submitted". No rows are deleted.
  await run("UPDATE complaints SET status = 'Submitted' WHERE status = 'Pending'");

  // Backfill reference numbers for pre-existing complaints.
  await run(`
    UPDATE complaints
    SET reference_no = 'CMP-' || COALESCE(strftime('%Y', created_at), '2026') || '-' || printf('%06d', id)
    WHERE reference_no IS NULL
  `);
  await run("UPDATE complaints SET last_activity_at = COALESCE(last_activity_at, updated_at, created_at)");
  await run("UPDATE complaints SET is_public = 1 WHERE is_public IS NULL");

  // Legacy rows were marked "Resolved" before resolved_at existed. Backfill the
  // timestamp so resolution-rate and average-resolution-time stay accurate.
  await run(`
    UPDATE complaints
    SET resolved_at = COALESCE(resolved_at, updated_at, created_at)
    WHERE status = 'Resolved' AND resolved_at IS NULL
  `);

  // Backfill denormalised category text for legacy rows so lists stay readable.
  await run("UPDATE complaints SET priority = COALESCE(priority, 'medium') WHERE priority IS NULL");
}

// ---------------------------------------------------------------------------
// Idempotent reference-data seeding (never overwrites administrator edits)
// ---------------------------------------------------------------------------
async function seedReferenceData() {
  for (const dept of DEPARTMENTS) {
    await run(
      `INSERT OR IGNORE INTO departments (code, name, description) VALUES (?, ?, ?)`,
      [dept.code, dept.name, dept.description]
    );
  }

  for (const ward of WARDS) {
    await run(
      `INSERT OR IGNORE INTO wards (code, name, zone, description) VALUES (?, ?, ?, ?)`,
      [ward.code, ward.name, ward.zone, null]
    );
  }

  const deptRows = await all("SELECT id, code FROM departments");
  const deptByCode = new Map(deptRows.map((d) => [d.code, d.id]));

  let categoryOrder = 0;
  for (const cat of CATEGORIES) {
    categoryOrder += 10;
    await run(
      `INSERT OR IGNORE INTO service_categories (code, name, kind, description, is_emergency, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cat.code, cat.name, cat.kind, cat.description, cat.is_emergency ? 1 : 0, categoryOrder]
    );
    const categoryRow = await get("SELECT id FROM service_categories WHERE code = ?", [cat.code]);
    if (!categoryRow) continue;

    let subOrder = 0;
    for (const sub of cat.subcategories) {
      subOrder += 10;
      const deptId = deptByCode.get(sub.department) || deptByCode.get("general") || null;
      await run(
        `INSERT OR IGNORE INTO service_subcategories
           (category_id, code, name, item_type, summary, checklist, processing_time, official_url,
            department_id, default_priority, sla_hours, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          categoryRow.id,
          sub.code,
          sub.name,
          sub.type || (cat.kind === "complaint" ? "complaint" : "information"),
          sub.summary || null,
          sub.checklist ? JSON.stringify(sub.checklist) : null,
          sub.processing_time || null,
          sub.official_url || null,
          deptId,
          sub.priority || "medium",
          sub.sla_hours || null,
          subOrder
        ]
      );
    }
  }

  const existingSla = await all("SELECT priority FROM sla_policies WHERE category_id IS NULL");
  const slaSeeded = new Set(existingSla.map((r) => r.priority));
  for (const policy of SLA_DEFAULTS) {
    if (slaSeeded.has(policy.priority)) continue;
    await run(
      `INSERT INTO sla_policies (priority, category_id, target_hours) VALUES (?, NULL, ?)`,
      [policy.priority, policy.target_hours]
    );
  }

  // Honest placeholders: contact details must be verified by an administrator.
  const officeCount = await get("SELECT COUNT(*) AS c FROM municipal_offices");
  if (!officeCount || officeCount.c === 0) {
    await run(
      `INSERT INTO municipal_offices (name, office_type, address, phone, email, office_hours)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "Municipal Head Office",
        "Head Office",
        "Contact details not configured. An administrator must publish verified office details here.",
        "Not configured",
        "Not configured",
        "Not configured"
      ]
    );
  }

  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('escalation_enabled', '1')`
  );
  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('duplicate_radius_meters', '300')`
  );
  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('duplicate_similarity', '0.55')`
  );
  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('public_min_group_count', '3')`
  );
  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('email_alerts_enabled', '1')`
  );
  await run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('support_inbox', ?)`,
    [process.env.SUPPORT_INBOX || ""]
  );

  // Seed demo bills for testing (only if no bills exist)
  const billCount = await get("SELECT COUNT(*) AS c FROM bills");
  if (!billCount || billCount.c === 0) {
    const users = await all("SELECT id FROM users WHERE role = 'user' LIMIT 10");
    const demoBills = [
      // Electricity bills
      { user_id: users[0]?.id || 1, service_type: "electricity", account_number: "ELEC-123456789", bill_number: "EB-2026-001234", billing_period_start: "2026-01-01", billing_period_end: "2026-01-31", amount_due: 250000, due_date: "2026-02-15", status: "pending", provider_name: "Demo Electricity Board", provider_bill_id: "DEMO-EB-001" },
      { user_id: users[1]?.id || 1, service_type: "electricity", account_number: "ELEC-987654321", bill_number: "EB-2026-001235", billing_period_start: "2026-02-01", billing_period_end: "2026-02-28", amount_due: 180000, due_date: "2026-03-15", status: "pending", provider_name: "Demo Electricity Board", provider_bill_id: "DEMO-EB-002" },
      // Water bills
      { user_id: users[0]?.id || 1, service_type: "water", account_number: "WAT-111222333", bill_number: "WB-2026-000456", billing_period_start: "2026-01-01", billing_period_end: "2026-03-31", amount_due: 85000, due_date: "2026-04-10", status: "pending", provider_name: "Demo Water Supply Board", provider_bill_id: "DEMO-WB-001" },
      { user_id: users[2]?.id || 1, service_type: "water", account_number: "WAT-444555666", bill_number: "WB-2026-000457", billing_period_start: "2026-01-01", billing_period_end: "2026-03-31", amount_due: 120000, due_date: "2026-04-10", status: "pending", provider_name: "Demo Water Supply Board", provider_bill_id: "DEMO-WB-002" },
      // Property tax bills
      { user_id: users[1]?.id || 1, service_type: "property_tax", account_number: "PTX-789012345", bill_number: "PT-2026-000789", billing_period_start: "2026-04-01", billing_period_end: "2027-03-31", amount_due: 450000, due_date: "2026-06-30", status: "pending", provider_name: "Municipal Corporation", provider_bill_id: "DEMO-PT-001" },
      { user_id: users[2]?.id || 1, service_type: "property_tax", account_number: "PTX-555666777", bill_number: "PT-2026-000790", billing_period_start: "2026-04-01", billing_period_end: "2027-03-31", amount_due: 320000, due_date: "2026-06-30", status: "pending", provider_name: "Municipal Corporation", provider_bill_id: "DEMO-PT-002" },
    ];
    for (const bill of demoBills) {
      await run(
        `INSERT INTO bills (user_id, service_type, account_number, bill_number, billing_period_start, billing_period_end, amount_due, due_date, status, provider_name, provider_bill_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bill.user_id, bill.service_type, bill.account_number, bill.bill_number, bill.billing_period_start, bill.billing_period_end, bill.amount_due, bill.due_date, bill.status, bill.provider_name, bill.provider_bill_id]
      );
    }
    console.log("Seeded demo bills for testing");
  }

  // Seed demo payments and receipts (only if none exist)
  const paymentCount = await get("SELECT COUNT(*) AS c FROM payment_transactions");
  if (!paymentCount || paymentCount.c === 0) {
    const bills = await all("SELECT id, user_id, service_type, account_number, bill_number, amount_due FROM bills LIMIT 4");
    if (bills.length > 0) {
      const demoPayments = [
        { bill: bills[0], amount: bills[0].amount_due, method: "upi", status: "captured", gateway: "demo", daysAgo: 5 },
        { bill: bills[1], amount: bills[1].amount_due, method: "card", status: "captured", gateway: "demo", daysAgo: 3 },
        { bill: bills[2], amount: bills[2].amount_due, method: "netbanking", status: "captured", gateway: "demo", daysAgo: 1 },
        { bill: bills[3], amount: bills[3].amount_due, method: "upi", status: "failed", gateway: "demo", daysAgo: 2 },
      ];
      for (const dp of demoPayments) {
        const bill = dp.bill;
        const paidAt = new Date(Date.now() - dp.daysAgo * 24 * 60 * 60 * 1000).toISOString();
        const gatewayPaymentId = `pay_demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const gatewayOrderId = `order_demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // Create payment order
        const orderResult = await run(
          `INSERT INTO payment_orders (user_id, bill_id, gateway, gateway_order_id, amount, currency, receipt, notes, status)
           VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 'paid')`,
          [bill.user_id, bill.id, dp.gateway, gatewayOrderId, dp.amount, `RCPT-${bill.service_type.slice(0,3).toUpperCase()}-${bill.id}`, JSON.stringify({bill_number: bill.bill_number, service_type: bill.service_type})]
        );

        // Create payment transaction
        const txnResult = await run(
          `INSERT INTO payment_transactions (user_id, bill_id, payment_order_id, gateway, gateway_payment_id, gateway_order_id, amount, currency, status, method, paid_at, verified_at, verified_by, raw_response)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)`,
          [bill.user_id, bill.id, orderResult.lastID, dp.gateway, gatewayPaymentId, gatewayOrderId, dp.amount, dp.status, dp.method, paidAt, paidAt, "webhook", JSON.stringify({demo: true})]
        );

        // Create receipt for successful payments
        if (dp.status === "captured") {
          const receiptNumber = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await run(
            `INSERT INTO payment_receipts (user_id, bill_id, transaction_id, receipt_number, amount_paid, payment_date, gateway_transaction_id, bill_category, bill_account_number, bill_number, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bill.user_id, bill.id, txnResult.lastID, receiptNumber, dp.amount, paidAt, gatewayPaymentId, bill.service_type, bill.account_number, bill.bill_number, JSON.stringify({})]
          );
        }

        // Update bill status
        if (dp.status === "captured") {
          await run(
            `UPDATE bills SET status = 'paid', amount_paid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [dp.amount, bill.id]
          );
        }
      }
      console.log("Seeded demo payments and receipts");
    }
  }
}

/**
 * Seeds the two accounts that ship with the portal: the administrator and one
 * service-desk officer. Both are driven by environment variables. The officer
 * exists so that complaints can be assigned to somebody — and the assignment
 * email alert can be demonstrated — straight after a fresh install.
 */
async function seedDefaultAccounts() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "admin@municipal.local").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  const adminHash = bcrypt.hashSync(adminPassword, 10);

  await run(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, role)
     VALUES (1, 'System Administrator', ?, ?, 'admin')`,
    [adminEmail, adminHash]
  );
  await run(
    `UPDATE users SET password_hash = ? WHERE email = ? AND role = 'admin'`,
    [adminHash, adminEmail]
  );

  const officerEmail = String(process.env.OFFICER_EMAIL || "officer@municipal.local").trim().toLowerCase();
  const officerPassword = process.env.OFFICER_PASSWORD || "Officer@123";
  const officerHash = bcrypt.hashSync(officerPassword, 10);
  const department = await get(`SELECT id FROM departments ORDER BY id LIMIT 1`);

  await run(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role, department_id, designation)
     VALUES ('Service Desk Officer', ?, ?, 'staff', ?, 'Complaint Officer')`,
    [officerEmail, officerHash, department ? department.id : null]
  );
  await run(
    `UPDATE users SET password_hash = ? WHERE email = ? AND role = 'staff'`,
    [officerHash, officerEmail]
  );

  // Seed a demo citizen with pending bills for testing
  const citizenEmail = "citizen@demo.local";
  const citizenPassword = "Citizen@123";
  const citizenHash = bcrypt.hashSync(citizenPassword, 10);

  const citizenResult = await run(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role, phone, address)
     VALUES ('Demo Citizen', ?, ?, 'user', '9876543210', '123 Demo Street, Demo City')`,
    [citizenEmail, citizenHash]
  );
  await run(
    `UPDATE users SET password_hash = ? WHERE email = ? AND role = 'user'`,
    [citizenHash, citizenEmail]
  );

  // Create pending bills for this demo citizen (only if they don't exist)
  const citizen = await get("SELECT id FROM users WHERE email = ?", [citizenEmail]);
  if (citizen) {
    const existingBills = await get("SELECT COUNT(*) AS c FROM bills WHERE user_id = ? AND account_number = 'ELEC-DEMO-001'", [citizen.id]);
    if (!existingBills || existingBills.c === 0) {
      const citizenBills = [
        { service_type: "electricity", account_number: "ELEC-DEMO-001", bill_number: "EB-2026-DEMO-001", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", amount_due: 320000, due_date: "2026-09-15", status: "pending", provider_name: "Demo Electricity Board", provider_bill_id: "DEMO-EB-CITIZEN-001" },
        { service_type: "water", account_number: "WAT-DEMO-001", bill_number: "WB-2026-DEMO-001", billing_period_start: "2026-07-01", billing_period_end: "2026-09-30", amount_due: 150000, due_date: "2026-10-10", status: "pending", provider_name: "Demo Water Supply Board", provider_bill_id: "DEMO-WB-CITIZEN-001" },
        { service_type: "property_tax", account_number: "PTX-DEMO-001", bill_number: "PT-2026-DEMO-001", billing_period_start: "2026-04-01", billing_period_end: "2027-03-31", amount_due: 550000, due_date: "2026-06-30", status: "overdue", provider_name: "Municipal Corporation", provider_bill_id: "DEMO-PT-CITIZEN-001" },
      ];
      for (const bill of citizenBills) {
        await run(
          `INSERT INTO bills (user_id, service_type, account_number, bill_number, billing_period_start, billing_period_end, amount_due, due_date, status, provider_name, provider_bill_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [citizen.id, bill.service_type, bill.account_number, bill.bill_number, bill.billing_period_start, bill.billing_period_end, bill.amount_due, bill.due_date, bill.status, bill.provider_name, bill.provider_bill_id]
        );
      }
      console.log(`Seeded demo citizen (${citizenEmail}) with 3 pending bills`);
    }
  }
}

let resolveReady;
let rejectReady;
const ready = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

(async () => {
  try {
    await createTables();
    await runColumnMigrations();
    await createIndexes();
    await seedReferenceData();
    await seedDefaultAccounts();
    console.log("Database ready (migrations + reference data seeded).");
    resolveReady();
  } catch (err) {
    console.error("Database initialisation failed:", err);
    rejectReady(err);
  }
})();

db.ready = ready;
db.runAsync = run;
db.allAsync = all;
db.getAsync = get;

module.exports = db;
