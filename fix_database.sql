-- 1. Explicitly grant SELECT permission to the authenticated user role
-- "permission denied" often means the role simply doesn't have privileges, distinct from RLS.
GRANT SELECT ON TABLE public.groups TO authenticated;
GRANT SELECT ON TABLE public.groups TO service_role;

-- 2. Ensure RLS is disabled (just in case)
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

-- 3. (Optional) Insert some dummy groups if the table is empty
-- Uncomment the lines below if you need sample data
-- INSERT INTO public.groups (name) VALUES ('Application Support') ON CONFLICT DO NOTHING;
-- INSERT INTO public.groups (name) VALUES ('Network Security') ON CONFLICT DO NOTHING;
-- INSERT INTO public.groups (name) VALUES ('Hardware Support') ON CONFLICT DO NOTHING;
