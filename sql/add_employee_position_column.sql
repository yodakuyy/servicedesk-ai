-- Migration to add employee_position to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_position TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
