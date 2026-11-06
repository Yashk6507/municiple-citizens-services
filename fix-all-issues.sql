-- Fix all RLS and permission issues
-- Run this in Supabase SQL Editor

-- 1. Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view comments on their complaints" ON public.complaint_comments;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- 2. Disable RLS temporarily on tables that should be public
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_categories DISABLE ROW LEVEL SECURITY;

-- 3. Create simple, non-recursive policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

-- 4. Create policies for complaints table
CREATE POLICY "Anyone can view public complaints" ON public.complaints
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view own complaints" ON public.complaints
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

CREATE POLICY "Users can create complaints" ON public.complaints
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

CREATE POLICY "Admins can delete complaints" ON public.complaints
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

-- 5. Create policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- 6. Create policies for comments
CREATE POLICY "Users can view non-internal comments" ON public.complaint_comments
  FOR SELECT
  USING (
    NOT is_internal
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

CREATE POLICY "Users can create comments" ON public.complaint_comments
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- 7. Create policies for audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin', 'staff')
  );

CREATE POLICY "System can create audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- 8. Grant public access to departments and categories
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT SELECT ON public.complaint_categories TO anon, authenticated;
GRANT SELECT ON public.complaint_statistics TO anon, authenticated;

-- 9. Create helper function to get current user role (avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Done!
SELECT 'RLS policies fixed successfully!' as status;
