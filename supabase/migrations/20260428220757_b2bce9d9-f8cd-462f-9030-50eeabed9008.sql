CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  default_related_type text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_templates_read" ON public.checklist_templates;
CREATE POLICY "checklist_templates_read" ON public.checklist_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_templates_admin_write" ON public.checklist_templates;
CREATE POLICY "checklist_templates_admin_write" ON public.checklist_templates
  FOR ALL TO authenticated USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());

DROP TRIGGER IF EXISTS tg_checklist_templates_updated_at ON public.checklist_templates;
CREATE TRIGGER tg_checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS template_key text;

INSERT INTO public.checklist_templates (key, title, description, default_related_type, items) VALUES
  ('objektaufnahme', 'Objektaufnahme', 'Standardablauf bei der Aufnahme eines neuen Objekts.', 'property',
    '["Erstkontakt mit Eigentümer geführt","Objekttermin vor Ort vereinbart","Objektbesichtigung & Aufmass durchgeführt","Fotos und Grundrisse erstellt","Marktwertanalyse erstellt","Mandatsentwurf vorbereitet","Daten im CRM erfasst"]'::jsonb),
  ('verkaufsmandat', 'Verkaufsmandat', 'Schritte vom Mandat bis zur Vermarktung.', 'property',
    '["Verkaufsmandat unterzeichnet","Eckdaten vollständig erfasst","Exposé erstellt und freigegeben","Inserate auf Portalen geschaltet","Anfragen qualifiziert","Besichtigungen durchgeführt","Kaufofferte verhandelt","Beurkundung beim Notar","Übergabe vorbereitet"]'::jsonb),
  ('vermietung', 'Vermietung', 'Standardprozess für eine Mietvermarktung.', 'property',
    '["Mietmandat / Auftrag erfasst","Mietzins und Nebenkosten kalkuliert","Inserat erstellt","Bewerbungen geprüft (Bonität, Referenzen)","Besichtigungen durchgeführt","Mieter ausgewählt","Mietvertrag erstellt und unterzeichnet","Kaution hinterlegt","Wohnungsübergabeprotokoll erstellt"]'::jsonb),
  ('reservation', 'Reservation', 'Ablauf einer Objektreservation.', 'property',
    '["Reservationsvereinbarung erstellt","Reservationsgebühr eingegangen","Finanzierung geprüft","Frist für Notartermin gesetzt","Finanzierungsbestätigung erhalten","Reservation in Verkauf umgewandelt"]'::jsonb),
  ('notartermin', 'Notartermin', 'Vorbereitung und Durchführung der Beurkundung.', 'property',
    '["Notar ausgewählt und beauftragt","Vertragsentwurf erhalten","Entwurf mit Käufer geprüft","Entwurf mit Verkäufer geprüft","Beurkundungstermin vereinbart","Identitätsnachweise eingeholt","Beurkundung durchgeführt","Kaufpreisfälligkeit überwacht","Eigentumsübertragung bestätigt"]'::jsonb),
  ('uebergabe', 'Übergabe', 'Schlüsselübergabe und Schlussabnahme.', 'property',
    '["Übergabetermin vereinbart","Zähler abgelesen (Strom, Wasser, Gas)","Schlüssel gezählt und übergeben","Übergabeprotokoll erstellt und unterzeichnet","Eventuelle Mängel dokumentiert","Versorger und Behörden informiert","Akte abgeschlossen"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  default_related_type = EXCLUDED.default_related_type,
  items = EXCLUDED.items,
  updated_at = now();
