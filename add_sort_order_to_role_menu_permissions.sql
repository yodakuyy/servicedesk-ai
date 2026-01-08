-- Add sort_order column to role_menu_permissions table
-- This column will allow each role to have its own custom menu ordering

-- Add the sort_order column with default value 0
ALTER TABLE role_menu_permissions 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add comment to document the purpose
COMMENT ON COLUMN role_menu_permissions.sort_order IS 'Custom sort order for menus per role. Lower values appear first. Default 0 maintains original order.';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'role_menu_permissions' 
AND column_name = 'sort_order';
