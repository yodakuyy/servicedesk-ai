-- RUN THIS IN SUPABASE SQL EDITOR TO FIX 'NO GROUP' ISSUE

-- 1. Unlock the user_groups table so the app can read/write to it
ALTER TABLE user_groups DISABLE ROW LEVEL SECURITY;

-- OR if you prefer to keep security on, use these policies:
-- ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON user_groups FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert" ON user_groups FOR INSERT WITH CHECK (true);
