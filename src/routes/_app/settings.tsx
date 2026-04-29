import { createFileRoute } from "@tanstack/react-router";
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
      <PageHeader title="Einstellungen" description="Profil, Firma, Bankkonten" />
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Mein Profil</TabsTrigger>
          <TabsTrigger value="company">Firma</TabsTrigger>
          <TabsTrigger value="banks">Bankkonten</TabsTrigger>
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

        <TabsContent value="banks">
          <div className="max-w-3xl"><BankAccountsManager /></div>
        </TabsContent>
      </Tabs>
    </>
  );
}
