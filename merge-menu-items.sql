-- ================================================
-- SQL Script: Merge Menu Items for Cleaner Sidebar
-- Run this in Supabase SQL Editor
-- ================================================

-- STEP 1: Check current menu structure first
SELECT id, label, key, order_no 
FROM public.menus 
ORDER BY order_no;

-- ================================================
-- STEP 2: Update menu labels (non-destructive)
-- ================================================

-- Update "All Incidents" label to just "Incidents"
UPDATE public.menus 
SET label = 'Incidents'
WHERE label ILIKE '%All Incidents%';

-- Update "All Service Request" label to "Service Requests"
UPDATE public.menus 
SET label = 'Service Requests'
WHERE label ILIKE '%All Service Request%';

-- ================================================
-- STEP 3: Verify the changes
-- ================================================
SELECT id, label, key, order_no 
FROM public.menus 
ORDER BY order_no;

-- ================================================
-- OPTIONAL: Hide "My" prefixed menus
-- Only uncomment if you want to hide them completely
-- First check if is_visible column exists
-- ================================================

-- Check table structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'menus';

-- If is_visible column exists:
-- UPDATE public.menus 
-- SET is_visible = false
-- WHERE label ILIKE 'My Incidents%' 
--    OR label ILIKE 'My Service Request%'
--    OR label ILIKE 'My Dashbord%';

-- ================================================
-- OPTIONAL: Delete "My" prefixed menus (destructive!)
-- Only use if you're sure you don't need them
-- ================================================

-- Get IDs of menus to delete
-- SELECT id, label FROM public.menus 
-- WHERE label ILIKE 'My Incidents%' 
--    OR label ILIKE 'My Service Request%';

-- Delete permissions first (foreign key constraint)
-- DELETE FROM public.role_menu_permissions 
-- WHERE menu_id IN (
--     SELECT id FROM public.menus 
--     WHERE label ILIKE 'My Incidents%' 
--        OR label ILIKE 'My Service Request%'
-- );

-- DELETE FROM public.user_menu_permissions 
-- WHERE menu_key IN (
--     SELECT id::text FROM public.menus 
--     WHERE label ILIKE 'My Incidents%' 
--        OR label ILIKE 'My Service Request%'
-- );

-- Then delete the menus
-- DELETE FROM public.menus 
-- WHERE label ILIKE 'My Incidents%' 
--    OR label ILIKE 'My Service Request%';
