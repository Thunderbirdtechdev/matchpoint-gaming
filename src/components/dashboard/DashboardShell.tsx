import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  Trophy, LayoutDashboard, Swords, Users, Wallet, ShieldAlert, User as UserIcon,
  ShieldCheck, BarChart3, LogOut, Gamepad2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/challenges", label: "Challenges", icon: Swords },
  { to: "/my-tournaments", label: "Tournaments", icon: Trophy },
  { to: "/community", label: "Community", icon: Users },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/dispute-center", label: "Disputes", icon: ShieldAlert },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

const staff = [
  { to: "/moderator", label: "Moderator", icon: ShieldCheck, role: "moderator" as const },
  { to: "/admin", label: "Admin", icon: ShieldCheck, role: "admin" as const },
  { to: "/analytics", label: "Analytics", icon: BarChart3, role: "admin" as const },
];

export function DashboardShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-border/50 bg-surface/30 lg:block">
          <div className="sticky top-0 flex h-screen flex-col p-5">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand glow-primary">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Match<span className="text-gradient-brand">Point</span></span>
            </Link>

            <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
              {nav.map((n) => {
                const active = path === n.to;
                return (
                  <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
                    <n.icon className="h-4 w-4" />{n.label}
                  </Link>
                );
              })}

              {staff.some((s) => roles?.includes(s.role)) && (
                <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</div>
              )}
              {staff.filter((s) => roles?.includes(s.role)).map((n) => {
                const active = path === n.to;
                return (
                  <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
                    <n.icon className="h-4 w-4" />{n.label}
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-xl border border-border/50 bg-surface p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">
                  {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{profile?.display_name ?? "Player"}</div>
                  <div className="truncate text-xs text-muted-foreground">{profile?.rank_tier} · {profile?.xp ?? 0} XP</div>
                </div>
              </div>
              <Button onClick={handleSignOut} variant="ghost" size="sm" className="mt-3 w-full justify-start text-muted-foreground hover:text-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div>
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 sm:px-8">
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <Link to="/games" className="hidden items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
                <Gamepad2 className="h-4 w-4" /> Browse games
              </Link>
            </div>
          </header>
          <div className="p-4 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
