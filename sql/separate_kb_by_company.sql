-- =============================================
-- SEPARATE KNOWLEDGE BASE BY COMPANY
-- =============================================

-- 1. Add company_id to kb_categories
ALTER TABLE public.kb_categories 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES public.company(company_id);

-- 2. Add company_id to kb_articles
ALTER TABLE public.kb_articles 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES public.company(company_id);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_categories_company_id ON public.kb_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_company_id ON public.kb_articles(company_id);

-- 4. Set comments for documentation
COMMENT ON COLUMN public.kb_categories.company_id IS 'Ownership company for this category';
COMMENT ON COLUMN public.kb_articles.company_id IS 'Ownership company for this article to prevent cross-company leakage';

-- 5. Optional: Migrate existing data
-- If you want to assign existing global articles to a default company (e.g., ID 1):
-- UPDATE public.kb_categories SET company_id = 1 WHERE company_id IS NULL;
-- UPDATE public.kb_articles SET company_id = 1 WHERE company_id IS NULL;
