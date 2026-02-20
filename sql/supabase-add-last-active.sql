-- Add last_active_at column to profiles table if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles(last_active_at DESC);

-- Update existing records with current timestamp if null
UPDATE public.profiles
SET last_active_at = NOW()
WHERE last_active_at IS NULL;
