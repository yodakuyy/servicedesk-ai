-- Add supervisor_id and assign_tasks_first columns to groups table if they don't exist

-- Add supervisor_id column (foreign key to profiles table)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'supervisor_id'
    ) THEN
        ALTER TABLE public.groups 
        ADD COLUMN supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add assign_tasks_first column (boolean, default false)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'assign_tasks_first'
    ) THEN
        ALTER TABLE public.groups 
        ADD COLUMN assign_tasks_first BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create index on supervisor_id for better query performance
CREATE INDEX IF NOT EXISTS idx_groups_supervisor_id ON public.groups(supervisor_id);

-- Update existing rows to have default values if needed
UPDATE public.groups 
SET assign_tasks_first = FALSE 
WHERE assign_tasks_first IS NULL;

COMMENT ON COLUMN public.groups.supervisor_id IS 'ID of the agent supervisor for this group';
COMMENT ON COLUMN public.groups.assign_tasks_first IS 'Whether to assign tasks to supervisor first before other agents';
