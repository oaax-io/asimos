DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM ('entwurf','pendent','vollstaendig','finanzierung','abgeschlossen','abgelehnt','storniert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status public.client_status NOT NULL DEFAULT 'entwurf';