import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile — MatchPoint" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance_cents").eq("user_id", user!.id).maybeSingle()).data,
  });

  const [form, setForm] = useState({ display_name: "", username: "", bio: "", favorite_game: "", platform: "", region: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      favorite_game: profile.favorite_game ?? "",
      platform: profile.platform ?? "",
      region: profile.region ?? "",
    });
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  return (
    <DashboardShell title="Your profile" subtitle="Manage how you appear to other players.">
      <div className="grid max-w-3xl gap-6 rounded-2xl border border-border/60 bg-gradient-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div className="space-y-2"><Label>Favorite game</Label><Input value={form.favorite_game} onChange={(e) => setForm({ ...form, favorite_game: e.target.value })} /></div>
          <div className="space-y-2"><Label>Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
          <div className="space-y-2"><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Bio</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
        <Button disabled={saving} onClick={save} className="w-fit bg-gradient-brand text-primary-foreground">{saving ? "Saving..." : "Save changes"}</Button>
      </div>

      <div className="mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reputation" value={profile?.reputation ?? 100} />
        <Stat label="XP" value={profile?.xp ?? 0} />
        <Stat label="Rank" value={profile?.rank_tier ?? "Bronze"} />
        <Stat label="Wallet" value={`$${((wallet?.balance_cents ?? 0) / 100).toFixed(2)}`} />
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/50 p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
