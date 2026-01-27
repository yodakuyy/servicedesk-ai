-- Check ticket_priority_enum values
SELECT n.nspname AS schema, t.typname AS type, e.enumlabel AS value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'ticket_priority_enum';

-- Also check ticket_type_enum just in case
SELECT n.nspname AS schema, t.typname AS type, e.enumlabel AS value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'ticket_type_enum';
