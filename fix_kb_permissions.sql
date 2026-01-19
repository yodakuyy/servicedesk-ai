-- =============================================
-- FIX RLS PERMISSIONS FOR KNOWLEDGE BASE TABLES
-- =============================================

-- Option 1: Disable RLS (Quick fix for development)
ALTER TABLE kb_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_internal_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_ticket_usage DISABLE ROW LEVEL SECURITY;

-- =============================================
-- OR Option 2: Create proper RLS policies (Recommended for production)
-- Uncomment below if you want proper RLS policies instead
-- =============================================

/*
-- kb_categories policies
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to read kb_categories"
ON kb_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage kb_categories"
ON kb_categories FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role_id IN (1, 2) -- Admin and Supervisor
  )
);

-- kb_articles policies
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read published articles"
ON kb_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert articles"
ON kb_articles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update articles"
ON kb_articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete articles"
ON kb_articles FOR DELETE TO authenticated USING (true);

-- kb_article_tags policies
ALTER TABLE kb_article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for kb_article_tags"
ON kb_article_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kb_article_internal_notes policies
ALTER TABLE kb_article_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for kb_article_internal_notes"
ON kb_article_internal_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/
