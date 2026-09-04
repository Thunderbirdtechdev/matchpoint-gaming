import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/lib/profile.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { EligibilityCard } from "@/components/profile/EligibilityCard";
import { TwoFactorCard } from "@/components/security/TwoFactorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile — MatchPoint" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveFn = useServerFn(updateProfile);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("wallets").select("balance_cents").eq("user_id", user!.id).maybeSingle())
        .data,
  });

  const { data: stats } = useQuery({
    queryKey: ["player-stats", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("player_stats")
          .select("matches_played, wins, losses, earnings")
          .eq("user_id", user!.id)
          .maybeSingle()
      ).data,
  });

  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    favorite_game: "",
    platform: "",
    region: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      favorite_game: profile.favorite_game ?? "",
      platform: profile.platform ?? "",
      region: profile.region ?? "",
    });
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await saveFn({ data: form });
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const played = stats?.matches_played ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return (
    <DashboardShell title="Your profile" subtitle="Manage how you appear to other players.">
      <div className="grid max-w-3xl gap-6">
        {/* Identity */}
        <div className="grid gap-6 rounded-2xl border border-border/60 bg-gradient-card p-6">
          {user && (
            <AvatarUpload
              userId={user.id}
              avatarUrl={avatarUrl}
              displayName={form.display_name || form.username}
              onChange={(url) => {
                setAvatarUrl(url);
                qc.invalidateQueries({ queryKey: ["profile", user.id] });
              }}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                placeholder="lowercase, no spaces"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="favorite_game">Favorite game</Label>
              <Input
                id="favorite_game"
                value={form.favorite_game}
                onChange={(e) => setForm({ ...form, favorite_game: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Input
                id="platform"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={4}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={saving}
              onClick={save}
              className="bg-gradient-brand text-primary-foreground"
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {form.username && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/player/$username" params={{ username: form.username }}>
                  View public profile
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {user && <EligibilityCard userId={user.id} />}

        <TwoFactorCard />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Record" value={`${wins}-${losses}`} />
          <Stat label="Win rate" value={played > 0 ? `${winRate}%` : "—"} />
          <Stat label="Earnings" value={`$${Number(stats?.earnings ?? 0).toFixed(2)}`} />
          <Stat label="Wallet" value={`$${((wallet?.balance_cents ?? 0) / 100).toFixed(2)}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Reputation" value={profile?.reputation ?? 100} />
          <Stat label="XP" value={profile?.xp ?? 0} />
          <Stat label="Rank" value={profile?.rank_tier ?? "Bronze"} />
        </div>
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
