import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";
import { BankAccountsManager } from "@/components/settings/BankAccountsManager";
import { BrandkitForm } from "@/components/settings/BrandkitForm";
import { FileCode2, ExternalLink, Tags, FileSignature } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ full_name: "", phone: "" });

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return p;
    },
  });

  useEffect(() => {
    if (data) setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "" });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(profile).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil gespeichert");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Einstellungen" description="Profil, Firma, Bankkonten, Vorlagen" />
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Mein Profil</TabsTrigger>
          <TabsTrigger value="company">Firmenprofile</TabsTrigger>
          <TabsTrigger value="brandkit">Brandkit</TabsTrigger>
          <TabsTrigger value="banks">Bankkonten</TabsTrigger>
          <TabsTrigger value="templates">Dokumentvorlagen</TabsTrigger>
          <TabsTrigger value="categories">Dokumentkategorien</TabsTrigger>
          <TabsTrigger value="esign">PDF / E-Sign</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Mein Profil</h2>
              <div><Label>E-Mail</Label><Input value={user?.email ?? ""} disabled /></div>
              <div><Label>Name</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <div className="max-w-3xl"><CompanyProfileForm /></div>
        </TabsContent>

        <TabsContent value="brandkit">
          <BrandkitForm />
        </TabsContent>

        <TabsContent value="banks">
          <div className="max-w-3xl"><BankAccountsManager /></div>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="max-w-3xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <FileCode2 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Dokumentvorlagen</h2>
                  <p className="text-sm text-muted-foreground">
                    Verwalte HTML-Vorlagen für Mandate, Reservationen, NDAs und Exposés.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/templates">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Vorlagen öffnen
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="max-w-3xl">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <Tags className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Dokumentkategorien</h2>
                  <p className="text-sm text-muted-foreground">
                    Vordefinierte Typen im Dokumentencenter:
                  </p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <li>• Vertrag</li>
                <li>• Exposé</li>
                <li>• Ausweis</li>
                <li>• Rechnung</li>
                <li>• Energieausweis</li>
                <li>• Grundriss</li>
                <li>• Kontoauszug</li>
                <li>• Steuerunterlage</li>
                <li>• Sonstiges</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Eigene Kategorien können später ergänzt werden, sobald wir das Schema dafür öffnen.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="esign">
          <Card className="max-w-3xl">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <FileSignature className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">PDF / E-Sign</h2>
                  <p className="text-sm text-muted-foreground">
                    Status der Dokumentauslieferung und elektronischen Signatur.
                  </p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p><strong>PDF-Export:</strong> Browser-Print aktiv. Server-PDF-Funktion vorbereitet (Stub).</p>
                <p className="mt-2"><strong>E-Sign:</strong> Architektur bereit für Skribble und DocuSign. Noch kein Anbieter aktiv.</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sobald ein Anbieter ausgewählt ist, werden API-Keys über die Lovable Cloud Secrets verwaltet.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
