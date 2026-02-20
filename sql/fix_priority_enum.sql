-- FIX PRIORITY ENUM
-- Ensures all necessary values exist in the ticket_priority_enum
-- Run this in the Supabase SQL Editor

-- 1. Check existing values and add missing ones
DO $$ 
BEGIN
    -- Check if 'low' (lowercase) exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'low') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'low';
    END IF;

    -- Check if 'medium' (lowercase) exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'medium') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'medium';
    END IF;

    -- Check if 'high' (lowercase) exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'high') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'high';
    END IF;

    -- Check if 'urgent' (lowercase) exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'urgent') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'urgent';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Handle case where value might be added between check and alter
        NULL;
END $$;

-- 2. Optional: Add Title Case as well if the app relies on it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'Low') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'Low';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'Medium') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'Medium';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'High') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'High';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ticket_priority_enum' AND e.enumlabel = 'Urgent') THEN
        ALTER TYPE public.ticket_priority_enum ADD VALUE 'Urgent';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
