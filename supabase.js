const { createClient } = require('@supabase/supabase-js');

// Load environment variables
try { require('dotenv').config(); } catch (e) {}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  console.error('Required: SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

// Client for user operations (respects RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for service operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

/**
 * Initialize database with default data
 */
async function initializeDatabase() {
  try {
    // Check if admin user exists
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', process.env.ADMIN_EMAIL || 'admin@municipal.local')
      .single();

    if (!adminUser && !adminError) {
      // Create admin user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: process.env.ADMIN_EMAIL || 'admin@municipal.local',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        email_confirm: true,
      });

      if (authError) {
        console.error('Error creating admin auth user:', authError.message);
      } else if (authData.user) {
        // Create admin user in public.users table
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            auth_id: authData.user.id,
            name: 'System Administrator',
            email: process.env.ADMIN_EMAIL || 'admin@municipal.local',
            role: 'admin',
          });

        if (userError) {
          console.error('Error creating admin user record:', userError.message);
        } else {
          console.log('✓ Admin user created successfully');
        }
      }
    } else {
      console.log('✓ Database already initialized');
    }
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }
}

/**
 * Helper function to execute query with error handling
 */
async function executeQuery(queryFn) {
  try {
    const result = await queryFn();
    if (result.error) {
      throw result.error;
    }
    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}

/**
 * Create audit log entry
 */
async function createAuditLog(userId, action, entityType, entityId, oldValues, newValues, req) {
  try {
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: req?.ip || req?.connection?.remoteAddress,
        user_agent: req?.headers?.['user-agent'],
      });
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
}

/**
 * Create notification
 */
async function createNotification(userId, complaintId, type, title, message) {
  try {
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        complaint_id: complaintId,
        type,
        title,
        message,
      });
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  initializeDatabase,
  executeQuery,
  createAuditLog,
  createNotification,
};
