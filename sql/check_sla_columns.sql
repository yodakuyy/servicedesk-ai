
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sla_targets'
ORDER BY ordinal_position;
