-- Migration for Team Planning, Planned Visits, Follow-ups, and Notifications

-- Ensure columns exist on planned_visits
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planned_visits' AND column_name='reschedule_reason') THEN
    ALTER TABLE planned_visits ADD COLUMN reschedule_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planned_visits' AND column_name='estimated_duration') THEN
    ALTER TABLE planned_visits ADD COLUMN estimated_duration INT DEFAULT 60;
  END IF;
END $$;

-- FOLLOW UPS TABLE
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  priority TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'PENDING',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE planned_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR PLANNED VISITS
DROP POLICY IF EXISTS "Planned visits viewable by authenticated" ON planned_visits;
CREATE POLICY "Planned visits viewable by authenticated" ON planned_visits
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Planned visits insertable by authenticated" ON planned_visits;
CREATE POLICY "Planned visits insertable by authenticated" ON planned_visits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Planned visits updatable by authenticated" ON planned_visits;
CREATE POLICY "Planned visits updatable by authenticated" ON planned_visits
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Planned visits deletable by authenticated" ON planned_visits;
CREATE POLICY "Planned visits deletable by authenticated" ON planned_visits
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- POLICIES FOR FOLLOW UPS
DROP POLICY IF EXISTS "Follow ups viewable by authenticated" ON follow_ups;
CREATE POLICY "Follow ups viewable by authenticated" ON follow_ups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Follow ups insertable by authenticated" ON follow_ups;
CREATE POLICY "Follow ups insertable by authenticated" ON follow_ups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Follow ups updatable by authenticated" ON follow_ups;
CREATE POLICY "Follow ups updatable by authenticated" ON follow_ups
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- POLICIES FOR NOTIFICATIONS
DROP POLICY IF EXISTS "Notifications viewable by authenticated" ON notifications;
CREATE POLICY "Notifications viewable by authenticated" ON notifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Notifications insertable by authenticated" ON notifications;
CREATE POLICY "Notifications insertable by authenticated" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Notifications updatable by authenticated" ON notifications;
CREATE POLICY "Notifications updatable by authenticated" ON notifications
  FOR UPDATE USING (auth.uid() IS NOT NULL);
