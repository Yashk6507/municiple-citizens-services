-- Municipal Portal Database Schema for Supabase
-- Execute this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff')),
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  head_email TEXT,
  contact_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaint categories table
CREATE TABLE IF NOT EXISTS public.complaint_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  department_id UUID REFERENCES public.departments(id),
  priority_default TEXT DEFAULT 'medium' CHECK (priority_default IN ('low', 'medium', 'high', 'critical')),
  sla_hours INTEGER DEFAULT 72,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  category_id UUID REFERENCES public.complaint_categories(id),
  department_id UUID REFERENCES public.departments(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_text TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Resolved', 'Rejected', 'Closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ,
  admin_remarks TEXT,
  resolution_notes TEXT,
  estimated_resolution_date TIMESTAMPTZ,
  actual_resolution_date TIMESTAMPTZ,
  citizen_satisfaction_rating INTEGER CHECK (citizen_satisfaction_rating BETWEEN 1 AND 5),
  citizen_feedback TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaint status history
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  changed_by_email TEXT,
  remarks TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments/Updates table
CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments table
CREATE TABLE IF NOT EXISTS public.complaint_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_department ON public.complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_number ON public.complaints(complaint_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Create function to generate complaint number
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(complaint_number FROM 10) AS INTEGER)), 0) + 1
  INTO next_seq
  FROM public.complaints
  WHERE complaint_number LIKE 'CMP-' || year_part || '-%';

  sequence_part := LPAD(next_seq::TEXT, 6, '0');

  RETURN 'CMP-' || year_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate complaint number
CREATE OR REPLACE FUNCTION set_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complaint_number IS NULL THEN
    NEW.complaint_number := generate_complaint_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_complaint_number ON public.complaints;

CREATE TRIGGER trigger_set_complaint_number
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION set_complaint_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_complaints_updated_at ON public.complaints;

CREATE TRIGGER trigger_update_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default departments
INSERT INTO public.departments (name, description, contact_number) VALUES
  ('Public Works', 'Road maintenance, potholes, and infrastructure', '1800-111-001'),
  ('Sanitation', 'Garbage collection and waste management', '1800-111-002'),
  ('Water Supply', 'Water supply and leakage issues', '1800-111-003'),
  ('Electricity', 'Street lights and power issues', '1800-111-004'),
  ('Parks & Recreation', 'Parks, gardens, and public spaces', '1800-111-005'),
  ('General', 'Other civic issues', '1800-111-000')
ON CONFLICT (name) DO NOTHING;

-- Insert default complaint categories
INSERT INTO public.complaint_categories (name, description, priority_default, sla_hours)
SELECT 'Garbage', 'Garbage collection and disposal issues', 'medium', 48
WHERE NOT EXISTS (SELECT 1 FROM public.complaint_categories WHERE name = 'Garbage');

INSERT INTO public.complaint_categories (name, description, priority_default, sla_hours)
SELECT 'Pothole', 'Road potholes and damage', 'high', 72
WHERE NOT EXISTS (SELECT 1 FROM public.complaint_categories WHERE name = 'Pothole');

INSERT INTO public.complaint_categories (name, description, priority_default, sla_hours)
SELECT 'Water Leakage', 'Water pipe leakage and supply issues', 'high', 24
WHERE NOT EXISTS (SELECT 1 FROM public.complaint_categories WHERE name = 'Water Leakage');

INSERT INTO public.complaint_categories (name, description, priority_default, sla_hours)
SELECT 'Streetlight', 'Street light failures', 'medium', 48
WHERE NOT EXISTS (SELECT 1 FROM public.complaint_categories WHERE name = 'Streetlight');

INSERT INTO public.complaint_categories (name, description, priority_default, sla_hours)
SELECT 'Other', 'Other civic issues', 'low', 96
WHERE NOT EXISTS (SELECT 1 FROM public.complaint_categories WHERE name = 'Other');

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Users can view their own complaints
CREATE POLICY "Users can view own complaints" ON public.complaints
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR is_public = true
  );

-- Users can insert their own complaints
CREATE POLICY "Users can create complaints" ON public.complaints
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Admins can view all complaints
CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Admins can update complaints
CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create view for complaint statistics
CREATE OR REPLACE VIEW public.complaint_statistics AS
SELECT
  COUNT(*) as total_complaints,
  COUNT(*) FILTER (WHERE status = 'Pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress_count,
  COUNT(*) FILTER (WHERE status = 'Resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'Rejected') as rejected_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30_days,
  AVG(citizen_satisfaction_rating) as avg_rating,
  AVG(EXTRACT(EPOCH FROM (actual_resolution_date - created_at))/3600) as avg_resolution_hours
FROM public.complaints;

GRANT SELECT ON public.complaint_statistics TO anon, authenticated;
