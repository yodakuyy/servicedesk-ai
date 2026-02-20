-- Add status column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';

-- Create out_of_office table
CREATE TABLE IF NOT EXISTS public.out_of_office (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'Leave', 'Sick', 'Training', 'Emergency', 'Other'
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Ended', 'Cancelled'
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tickets_reassigned INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.out_of_office ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own OOO" ON public.out_of_office
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view all OOO" ON public.out_of_office
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role_id = 1 OR role_id = 2)
        )
    );

CREATE POLICY "Users can insert their own OOO" ON public.out_of_office
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors can insert OOO for anyone" ON public.out_of_office
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role_id = 1 OR role_id = 2)
        )
    );

CREATE POLICY "Users can update their own OOO" ON public.out_of_office
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can update any OOO" ON public.out_of_office
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role_id = 1 OR role_id = 2)
        )
    );

-- Table for tracking reassignment in activity log
-- Assuming tickets table exists. If not, this is just a reminder for the logic.

-- Refresh permissions
GRANT ALL ON public.out_of_office TO authenticated;
GRANT ALL ON public.out_of_office TO service_role;
