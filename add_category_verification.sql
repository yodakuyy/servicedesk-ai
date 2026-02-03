-- Add is_category_verified column to tickets table
-- Default to false since new tickets are auto-classified by system
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_category_verified BOOLEAN DEFAULT FALSE;

-- Update existing tickets to true so they don't all show as 'unverified'
UPDATE tickets SET is_category_verified = TRUE;

-- Optionally, add a column for who verified it
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_verified_by UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_verified_at TIMESTAMP WITH TIME ZONE;
