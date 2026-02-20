-- Create business_hours table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    weekly_schedule JSONB,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Allow all access to authenticated users and service role
CREATE POLICY "Allow all access for authenticated users" ON public.business_hours
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for service role" ON public.business_hours
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Add business_hour_id to groups table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'business_hour_id'
    ) THEN
        ALTER TABLE public.groups 
        ADD COLUMN business_hour_id UUID REFERENCES public.business_hours(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Insert default business hours if table is empty
INSERT INTO public.business_hours (name, timezone, status, weekly_schedule)
SELECT 'Office Hours DIT', 'Asia/Jakarta', 'Active', 
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

-- Refresh permissions
GRANT ALL ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;
