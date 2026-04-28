import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ full_name: "", phone: "" });
  const [agency, setAgency] = useState({ name: "" });

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*, agencies(*)").eq("id", user!.id).single();
      return p;
    },
  });

  useEffect(() => {
    if (data) {
      setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "" });
      setAgency({ name: (data as any).agencies?.name ?? "" });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("profiles").update(profile).eq("id", user!.id);
      if (e1) throw e1;
      if (data?.agency_id) {
        const { error: e2 } = await supabase.from("agencies").update({ name: agency.name }).eq("id", data.agency_id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Gespeichert"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Einstellungen" description="Profil und Firma" />
      <div className="grid max-w-2xl gap-6">
        <Card><CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Profil</h2>
          <div><Label>E-Mail</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>Name</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div><Label>Telefon</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        </CardContent></Card>

        <Card><CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Firma</h2>
          <div><Label>Name</Label><Input value={agency.name} onChange={(e) => setAgency({ name: e.target.value })} /></div>
        </CardContent></Card>

        <div><Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button></div>
      </div>
    </>
  );
}
