import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Trophy,
  LayoutDashboard,
  Swords,
  Users,
  Wallet,
  ShieldAlert,
  User as UserIcon,
  ShieldCheck,
  BarChart3,
  LogOut,
  Gamepad2,
  Banknote,
  LifeBuoy,
  LineChart,
  FileClock,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { ROLE_LABELS, type Capability } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/challenges", label: "Challenges", icon: Swords },
  { to: "/my-tournaments", label: "Tournaments", icon: Trophy },
  { to: "/community", label: "Community", icon: Users },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/dispute-center", label: "Disputes", icon: ShieldAlert },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

/**
 * Staff nav, keyed on capability rather than role.
 *
 * These were `role: "admin"` literals, which meant a financial_admin — the role
 * whose entire job is Payouts — would not see the Payouts link, and a
 * super_admin holding only that role would see no staff nav at all.
 */
const staff = [
  { to: "/moderator", label: "Moderator", icon: ShieldCheck, capability: "moderation.tickets" },
  { to: "/admin", label: "Admin", icon: ShieldCheck, capability: "roles.view" },
  { to: "/finance", label: "Finance", icon: LineChart, capability: "finance.view" },
  { to: "/payouts", label: "Payouts", icon: Banknote, capability: "finance.payouts" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, capability: "platform.analytics" },
  { to: "/security", label: "Security", icon: FileClock, capability: "security.audit.view" },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: typeof ShieldCheck;
  capability: Capability;
}[];

const linkClass = (active: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
    active
      ? "bg-primary/15 text-foreground"
      : "text-muted-foreground hover:bg-surface hover:text-foreground"
  }`;

/**
 * Module 11 — the sidebar contents, defined once.
 *
 * Desktop renders this in a fixed column; mobile renders the identical thing
 * inside a slide-over. Writing it twice is how the two drift, and a nav that
 * differs by viewport is worse than one that is merely small: a player learns
 * the app on their phone and then cannot find the same link on a laptop.
 *
 * `onNavigate` closes the mobile sheet. It is a no-op on desktop.
 */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { can, roles } = useRoles();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const topStaffRole = (["super_admin", "admin", "financial_admin", "moderator"] as const).find(
    (r) => roles.includes(r),
  );

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    onNavigate?.();
    navigate({ to: "/" });
  }

  return (
    <div className="flex h-full flex-col p-5">
      <Link to="/" className="flex items-center gap-2" onClick={onNavigate}>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand glow-primary">
          <Trophy className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">
          Match<span className="text-gradient-brand">Point</span>
        </span>
      </Link>

      {/* min-h-0 + overflow-y-auto: on a short phone in landscape the staff nav
          is taller than the viewport, and without this the sign-out button at
          the bottom becomes unreachable. */}
      <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-sm">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className={linkClass(path === n.to)} onClick={onNavigate}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}

        {staff.some((s) => can(s.capability)) && (
          <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff
          </div>
        )}
        {staff
          .filter((s) => can(s.capability))
          .map((n) => (
            <Link key={n.to} to={n.to} className={linkClass(path === n.to)} onClick={onNavigate}>
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
      </nav>

      <div className="mt-4 shrink-0 rounded-xl border border-border/50 bg-surface p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">
            {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{profile?.display_name ?? "Player"}</div>
            <div className="truncate text-xs text-muted-foreground">
              {profile?.rank_tier} · {profile?.xp ?? 0} XP
            </div>
            {/* Staff act on other people's money and matches — knowing
                which hat you're wearing matters more than it does for a
                player, so the highest-ranking role is always visible. */}
            {topStaffRole && (
              <div className="mt-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-glow">
                {ROLE_LABELS[topStaffRole]}
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /*
   * Module 11 — close the drawer whenever the route changes.
   *
   * The link's own onClick handles a tap, but not the browser back button:
   * without this, going back leaves the drawer open over the previous page,
   * which reads as the app having frozen.
   */
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-border/50 bg-surface/30 lg:block">
          <div className="sticky top-0 h-screen">
            <SidebarBody />
          </div>
        </aside>

        {/*
         * Module 11 — the mobile drawer.
         *
         * Before this, the sidebar was `hidden lg:block` with nothing behind
         * it: below 1024px a signed-in player had no navigation, no way to
         * reach their wallet, and no sign-out button. The marketing site had a
         * working mobile menu the whole time, so the platform was harder to use
         * once you logged in than before.
         */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
            {/* Radix requires a title for screen readers; it is not shown. */}
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBody onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                  {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <Link
                to="/games"
                className="hidden shrink-0 items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
              >
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
