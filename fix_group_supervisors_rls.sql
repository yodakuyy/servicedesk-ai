-- Enable RLS on group_supervisors if not enabled
ALTER TABLE group_supervisors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for authenticated users (or adjust based on your needs)
-- This allows viewing, inserting, and deleting supervisors
CREATE POLICY "Enable all access for authenticated users" ON "public"."group_supervisors"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Alternatively, if you want to be more specific:
-- CREATE POLICY "Enable read access for all users" ON "public"."group_supervisors" FOR SELECT USING (true);
-- CREATE POLICY "Enable insert for authenticated users only" ON "public"."group_supervisors" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- ... etc

-- Verifikasi permission lain
GRANT ALL ON TABLE group_supervisors TO authenticated;
GRANT ALL ON TABLE group_supervisors TO service_role;
