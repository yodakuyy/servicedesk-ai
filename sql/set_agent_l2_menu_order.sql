-- Set menu order for Agent L2 role
-- Order: Escalated Tickets → My Tickets → Knowledge Base

-- First, let's identify the role_id for Agent L2 and menu IDs
SELECT 
    '=== Agent L2 Role ===' as info,
    id as role_id,
    role_name
FROM roles 
WHERE role_name ILIKE '%Agent L2%' OR role_name ILIKE '%L2%';

SELECT 
    '=== Menu IDs ===' as info,
    id as menu_id,
    name,
    label,
    menu_name
FROM menus 
WHERE name IN ('Escalated Tickets', 'My Tickets', 'Knowledge Base')
   OR label IN ('Escalated Tickets', 'My Tickets', 'Knowledge Base')
   OR menu_name IN ('Escalated Tickets', 'My Tickets', 'Knowledge Base');

-- Update sort_order for Agent L2 menus
-- IMPORTANT: Replace the role_id below with the actual role_id from the query above
-- and menu_id values with the actual menu_id values from the query above

-- Example (update with actual values after running the queries above):
-- UPDATE role_menu_permissions
-- SET sort_order = 1
-- WHERE role_id = <AGENT_L2_ROLE_ID>
-- AND menu_id = <ESCALATED_TICKETS_MENU_ID>;

-- UPDATE role_menu_permissions
-- SET sort_order = 2
-- WHERE role_id = <AGENT_L2_ROLE_ID>
-- AND menu_id = <MY_TICKETS_MENU_ID>;

-- UPDATE role_menu_permissions
-- SET sort_order = 3
-- WHERE role_id = <AGENT_L2_ROLE_ID>
-- AND menu_id = <KNOWLEDGE_BASE_MENU_ID>;

-- After updating, verify the order
SELECT 
    r.role_name,
    m.name as menu_name,
    m.label as menu_label,
    rmp.sort_order
FROM role_menu_permissions rmp
JOIN roles r ON rmp.role_id = r.id
JOIN menus m ON rmp.menu_id = m.id
WHERE r.role_name ILIKE '%Agent L2%' OR r.role_name ILIKE '%L2%'
ORDER BY rmp.sort_order ASC, m.name ASC;
