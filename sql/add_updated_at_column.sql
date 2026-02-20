-- Add updated_at column to sla_policies table if it doesn't exist
ALTER TABLE sla_policies 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Optional: Create a trigger to automatically update updated_at (if not handled by app code)
-- But since our app handles it, this is optional. 
-- However, having it at DB level is safer.
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--    NEW.updated_at = now();
--    RETURN NEW;
-- END;
-- $$ language 'plpgsql';
--
-- CREATE TRIGGER update_sla_policies_updated_at
-- BEFORE UPDATE ON sla_policies
-- FOR EACH ROW
-- EXECUTE PROCEDURE update_updated_at_column();
