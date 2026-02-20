-- =============================================
-- PORTAL HIGHLIGHTS TABLE
-- Used for login page right-side carousel slides
-- =============================================

CREATE TABLE IF NOT EXISTS public.portal_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    slide_type TEXT NOT NULL DEFAULT 'image' CHECK (slide_type IN ('image', 'component')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_highlights ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read (needed for login page - unauthenticated)
CREATE POLICY "Anyone can read portal highlights"
    ON public.portal_highlights
    FOR SELECT
    USING (true);

-- Policy: Admin & Supervisor can insert
CREATE POLICY "Admin and Supervisor can insert portal highlights"
    ON public.portal_highlights
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Policy: Admin & Supervisor can update
CREATE POLICY "Admin and Supervisor can update portal highlights"
    ON public.portal_highlights
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Policy: Admin & Supervisor can delete
CREATE POLICY "Admin and Supervisor can delete portal highlights"
    ON public.portal_highlights
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_portal_highlights_active ON public.portal_highlights (is_active, sort_order ASC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_portal_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portal_highlights_updated_at ON public.portal_highlights;
CREATE TRIGGER trg_portal_highlights_updated_at
    BEFORE UPDATE ON public.portal_highlights
    FOR EACH ROW
    EXECUTE FUNCTION update_portal_highlights_updated_at();

-- Seed default slides
INSERT INTO public.portal_highlights (title, subtitle, image_url, slide_type, sort_order, is_active)
VALUES
    ('Dashboard Overview', 'Turn your ideas into reality. Consistent quality and experience across all platforms and devices.', NULL, 'component', 0, true),
    ('New Legal Service Desk', 'We are excited to announce a dedicated support channel for the Legal Department. Submit contract reviews and risk assessments directly via the new portal.', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80', 'image', 1, true),
    ('System Maintenance Update', 'Scheduled maintenance will occur this Saturday from 10 PM to 2 AM. Please save your work as services will be briefly unavailable.', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80', 'image', 2, true);
