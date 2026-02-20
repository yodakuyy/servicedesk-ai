-- check_and_fix_holidays.sql

-- 1. Ensure table exists (it should, but good to be safe)
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date DATE NOT NULL,
    name TEXT NOT NULL,
    scope TEXT DEFAULT 'GLOBAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ENABLE RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- 3. DROP existing policies to reset
DROP POLICY IF EXISTS "Allow read access to all users" ON public.holidays;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.holidays;

-- 4. CREATE permissive policies (for now, to debug)
-- Allow anyone to read
CREATE POLICY "Allow read access to all users" ON public.holidays
FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow all access to authenticated users" ON public.holidays
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. INSERT a test holiday for December 2025 if none exists
-- This ensures the user sees something on the screen
INSERT INTO public.holidays (holiday_date, name, scope)
SELECT '2025-12-25', 'Christmas Day (Test)', 'GLOBAL'
WHERE NOT EXISTS (
    SELECT 1 FROM public.holidays WHERE holiday_date = '2025-12-25'
);

INSERT INTO public.holidays (holiday_date, name, scope)
SELECT '2025-12-31', 'New Year Eve (Test)', 'GLOBAL'
WHERE NOT EXISTS (
    SELECT 1 FROM public.holidays WHERE holiday_date = '2025-12-31'
);

-- 6. Check count
SELECT count(*) as total_holidays FROM public.holidays;
