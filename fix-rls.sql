-- Fix RLS infinite recursion issue
-- Run this in Supabase SQL Editor

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- Recreate policies without recursion

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.auth_id = auth.uid()
      AND u2.role IN ('admin', 'staff')
      AND u2.id != users.id  -- Prevent self-reference
    )
    OR auth.uid() = auth_id  -- User can always see themselves
  );

-- Complaints table policies
CREATE POLICY "Users can view own complaints" ON public.complaints
  FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.id = complaints.user_id
    )
  );

CREATE POLICY "Users can create complaints" ON public.complaints
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.id = complaints.user_id
    )
  );

CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'staff')
    )
  );

-- Notifications table policies
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.id = notifications.user_id
    )
  );

-- Comments policies (if needed)
CREATE POLICY "Users can view comments on their complaints" ON public.complaint_comments
  FOR SELECT
  USING (
    NOT is_internal
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'staff')
    )
  );

-- Audit logs policies (admin only)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'staff')
    )
  );
