-- =============================================
-- ANNOUNCEMENTS TABLE
-- Used for My Dashboard announcement cards
-- =============================================

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'alert')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active announcements
CREATE POLICY "Anyone can read active announcements"
    ON public.announcements
    FOR SELECT
    USING (true);

-- Policy: Admin & Supervisor can insert
CREATE POLICY "Admin and Supervisor can insert announcements"
    ON public.announcements
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Policy: Admin & Supervisor can update
CREATE POLICY "Admin and Supervisor can update announcements"
    ON public.announcements
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Policy: Admin & Supervisor can delete
CREATE POLICY "Admin and Supervisor can delete announcements"
    ON public.announcements
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- Index for fast lookup of active announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (is_active, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();
