
-- Extend existing enums (one ADD per statement, IF NOT EXISTS to be safe)
ALTER TYPE public.lead_status   ADD VALUE IF NOT EXISTS 'viewing_planned';
ALTER TYPE public.client_type   ADD VALUE IF NOT EXISTS 'investor';
ALTER TYPE public.client_type   ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'preparation';
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'parking';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'mixed_use';
ALTER TYPE public.match_status  ADD VALUE IF NOT EXISTS 'shortlisted';

-- New enums
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner','admin','agent','assistant','backoffice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('open','in_progress','waiting','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('client_document','property_document','contract','mandate','reservation','financing','media','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mandate_status AS ENUM ('draft','sent','signed','active','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('draft','sent','signed','cancelled','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
