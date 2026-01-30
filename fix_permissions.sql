-- Enable RLS (Optional, but good practice)
ALTER TABLE group_sla_policies ENABLE ROW LEVEL SECURITY;

-- Allow public/authenticated access for now to match other tables in this project
DROP POLICY IF EXISTS "Allow all access to group_sla_policies" ON group_sla_policies;
CREATE POLICY "Allow all access to group_sla_policies" ON group_sla_policies 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Also make sure the service_role and authenticated roles have permission to the table
GRANT ALL ON group_sla_policies TO anon;
GRANT ALL ON group_sla_policies TO authenticated;
GRANT ALL ON group_sla_policies TO service_role;
