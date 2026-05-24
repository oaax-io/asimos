import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Mail, Phone, MapPin, Banknote, Home, Target, Calendar, FileSignature, MessageSquare, Heart, FileText, Activity, CheckSquare, BedDouble, Ruler, Building2 } from "lucide-react";

interface Props {
  trigger?: React.ReactNode;
}

const sample = {
  full_name: "Max Mustermann",
  client_type: "buyer",
  email: "max.mustermann@example.ch",
  phone: "+41 79 123 45 67",
  address: "Bahnhofstrasse 12",
  postal_code: "8001",
  city: "Zürich",
  country: "CH",
  notes: "Sucht aktiv eine 4.5-Zimmer-Wohnung in Zürich oder Umgebung. Eigenmittel vorhanden, Finanzierung in Klärung mit UBS.",
  budget_min: 900000,
  budget_max: 1400000,
  preferred_cities: ["Zürich", "Zollikon", "Küsnacht"],
  rooms_min: 4,
  area_min: 110,
  preferred_types: ["Wohnung", "Haus"],
  created_at: "2025-09-12",
};

const matches = [
  { id: 1, title: "4.5 Zi Wohnung, Zürich Enge", price: 1290000, score: 92 },
  { id: 2, title: "5 Zi Reihenhaus, Zollikon", price: 1380000, score: 87 },
  { id: 3, title: "4 Zi Maisonette, Wollishofen", price: 1150000, score: 81 },
];

const appointments = [
  { id: 1, title: "Besichtigung Enge", date: "28.05.2026 14:00", status: "Bestätigt" },
  { id: 2, title: "Beratungsgespräch", date: "15.05.2026 10:30", status: "Erledigt" },
];

const tasks = [
  { id: 1, label: "Selbstauskunft anfordern", done: true },
  { id: 2, label: "Termin Zollikon koordinieren", done: false },
  { id: 3, label: "Tragbarkeitsrechnung an Bank senden", done: false },
];

const relationships = [
  { name: "Anna Mustermann", role: "Ehepartnerin", email: "anna@example.ch" },
  { name: "Leo Mustermann", role: "Kind", email: "—" },
];

const documents = [
  { name: "Selbstauskunft_Mustermann.pdf", date: "10.05.2026" },
  { name: "Lohnausweis_2025.pdf", date: "02.05.2026" },
  { name: "Vorabbestätigung_UBS.pdf", date: "20.05.2026" },
];

export function SampleClientDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Sparkles className="mr-1.5 h-4 w-4" />Muster-Kunde
        </Button>
      )}
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Muster-Kunde (Demo)
          </DialogTitle>
        </DialogHeader>

        {/* Hero */}
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex gap-2">
                <Badge variant="secondary">Käufer</Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Selbstauskunft eingereicht</Badge>
                <Badge className="bg-amber-500 hover:bg-amber-500">Finanzierung in Prüfung</Badge>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold">{sample.full_name}</h2>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{sample.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{sample.phone}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{sample.address}, {sample.postal_code} {sample.city}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Target className="h-4 w-4" />} label="Matches" value={matches.length} />
            <Stat icon={<Calendar className="h-4 w-4" />} label="Termine" value={appointments.length} />
            <Stat icon={<FileSignature className="h-4 w-4" />} label="Finanzierung" value="78%" />
            <Stat icon={<Home className="h-4 w-4" />} label="Budget" value="CHF 1.4M" />
          </div>
        </div>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="consulting"><MessageSquare className="mr-1.5 h-4 w-4" />Beratung</TabsTrigger>
            <TabsTrigger value="financing"><FileSignature className="mr-1.5 h-4 w-4" />Finanzierung</TabsTrigger>
            <TabsTrigger value="search"><Target className="mr-1.5 h-4 w-4" />Suchprofil & Matching</TabsTrigger>
            <TabsTrigger value="relationships"><Heart className="mr-1.5 h-4 w-4" />Beziehungen</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="mr-1.5 h-4 w-4" />Dokumente</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2"><CardContent className="p-5">
                <h3 className="mb-4 font-display text-lg font-semibold">Suchprofil</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field icon={<Banknote className="h-4 w-4" />} label="Budget" value={`CHF ${sample.budget_min.toLocaleString()} – ${sample.budget_max.toLocaleString()}`} />
                  <Field icon={<MapPin className="h-4 w-4" />} label="Städte" value={sample.preferred_cities.join(", ")} />
                  <Field icon={<BedDouble className="h-4 w-4" />} label="Zimmer ab" value={sample.rooms_min} />
                  <Field icon={<Ruler className="h-4 w-4" />} label="Fläche ab" value={`${sample.area_min} m²`} />
                  <Field icon={<Building2 className="h-4 w-4" />} label="Objekttypen" value={sample.preferred_types.join(", ")} />
                  <Field icon={<Home className="h-4 w-4" />} label="Vermarktung" value="Kauf" />
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-display text-lg font-semibold">Notizen</h3>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sample.notes}</p>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="consulting" className="mt-4 space-y-3">
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Termine</h3>
              <div className="space-y-2">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div><p className="font-medium">{a.title}</p><p className="text-muted-foreground text-xs">{a.date}</p></div>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4" />Aufgaben</h3>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={t.done} readOnly />
                    <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.label}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Aktivität</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• 22.05.2026 — E-Mail mit Exposé Enge verschickt</li>
                <li>• 18.05.2026 — Telefonat (15 Min), Budget bestätigt</li>
                <li>• 10.05.2026 — Selbstauskunft erhalten</li>
              </ul>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="financing" className="mt-4 space-y-3">
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Quick-Check Tragbarkeit</h3>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Field label="Kaufpreis" value="CHF 1'290'000" />
                <Field label="Eigenmittel" value="CHF 320'000" />
                <Field label="Hypothek" value="CHF 970'000" />
                <Field label="Tragbarkeit" value="32%" />
              </div>
              <div className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
                ✓ Tragbarkeit erfüllt (inkl. Mitantragstellerin)
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Dossier Vollständigkeit</h3>
              <div className="h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: "78%" }} /></div>
              <p className="mt-2 text-sm text-muted-foreground">78% — Selbstauskunft, Lohnausweis & 3a-Auszug vorhanden. Fehlend: Betreibungsregisterauszug.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="search" className="mt-4">
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Top Matches</h3>
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div><p className="font-medium">{m.title}</p><p className="text-muted-foreground text-xs">CHF {m.price.toLocaleString()}</p></div>
                    <Badge className="bg-primary">{m.score}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="relationships" className="mt-4">
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Verknüpfte Personen</h3>
              <div className="space-y-2">
                {relationships.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div><p className="font-medium">{r.name}</p><p className="text-muted-foreground text-xs">{r.email}</p></div>
                    <Badge variant="secondary">{r.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <Card><CardContent className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Dokumente</h3>
              <div className="space-y-2">
                {documents.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span>{d.name}</span></div>
                    <span className="text-muted-foreground text-xs">{d.date}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-xs text-muted-foreground">
          Dies ist ein fester Demo-Kunde mit Beispieldaten. Keine Daten werden gespeichert oder verändert.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
