-- 1. Schema Fixes: Add missing columns
DO $$ 
BEGIN
    -- Add weekly_schedule if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_hours' AND column_name = 'weekly_schedule'
    ) THEN
        ALTER TABLE public.business_hours 
        ADD COLUMN weekly_schedule JSONB;
    END IF;

    -- Add is_active if missing (it seems to be preferred over status)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_hours' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.business_hours 
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Grant permissions
GRANT ALL ON TABLE public.business_hours TO authenticated;
GRANT ALL ON TABLE public.business_hours TO service_role;
GRANT ALL ON TABLE public.business_hours TO anon;

-- 3. Grant permissions to groups table
GRANT SELECT ON TABLE public.groups TO authenticated;
GRANT SELECT ON TABLE public.groups TO service_role;

-- 4. Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- 5. Recreate policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.business_hours;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.business_hours;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.business_hours;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.business_hours;

CREATE POLICY "Enable read access for all users" ON public.business_hours
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.business_hours
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.business_hours
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.business_hours
    FOR DELETE USING (auth.role() = 'authenticated');

-- 6. Insert dummy data
INSERT INTO public.business_hours (name, timezone, is_active, weekly_schedule)
SELECT 'Office Hours DIT', 'Asia/Jakarta', true, 
'[
    {"day": "Monday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00"},
    {"day": "Tuesday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00"},
    {"day": "Wednesday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00"},
    {"day": "Thursday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00"},
    {"day": "Friday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00"},
    {"day": "Saturday", "endTime": "17:00", "hasBreak": true, "isActive": false, "isClosed": true},
    {"day": "Sunday", "endTime": "17:00", "hasBreak": true, "isActive": false, "isClosed": true}
]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.business_hours);
