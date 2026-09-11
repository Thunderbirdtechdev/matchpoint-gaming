import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/dashboard/RequireCapability";
import { useRoles } from "@/hooks/use-roles";
import {
  APP_ROLES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  capabilityMapMatches,
  type AppRole,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/ui/status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Wallet, Copy, ExternalLink, RefreshCw, Banknote, Check, X, Clock, Gift, ShieldCheck, History, UserX } from "lucide-react";
import { toast } from "sonner";
import { lookupUserIdentities, adminGetAccountSummary, adminCloseAccount, adminListOpenMatches, adminCreditWallet, adminDebitWallet, adminGrantRole, adminRevokeRole, adminListStaff, adminListRoleAudit, getCompanyWallet, listCompanyRevenue, listCompanyWithdrawals, withdrawCompanyFunds, getStripeBalance, stripePayoutToBank, getRevenueSummary, getRevenueBySource, getPlatformTotals } from "@/lib/admin.functions";
import { getPlatformLiabilities, getRevenueDaily } from "@/lib/finance.functions";
import { RevenueChart } from "@/components/finance/RevenueChart";
import { listMfaStatus, adminResetUserMfa } from "@/lib/security.functions";
import { adminListPayoutRequests, adminUpdatePayoutRequest } from "@/lib/payouts.functions";
import { adminCreatePromoCode, adminListPromoCodes, adminTogglePromoCode } from "@/lib/promo.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin | MatchPoint" }] }),
  component: AdminPage,
});

/**
 * Every card here is gated on its own capability rather than on the page.
 *
 * That matters because /admin is now visited by two different jobs: an `admin`
 * sees revenue read-only, promo codes and the moderator roster; a
 * `financial_admin` sees payouts, the treasury and wallet adjustments and none
 * of the moderation tooling. Gating the page as a whole would have forced one
 * of them out entirely.
 */
function AdminPage() {
  const { can } = useRoles();

  const { data: users } = useQuery({
    queryKey: ["all-profiles"],
    enabled: can("users.view"),
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  /*
   * Emails, which `profiles` does not hold — they live on auth.users and are
   * unreachable from the browser. Without them a staff member looking at this
   * table cannot tell which account a support request belongs to.
   */
  const lookupFn = useServerFn(lookupUserIdentities);
  const { data: identities } = useQuery({
    queryKey: ["admin-user-emails", (users ?? []).length],
    enabled: can("users.view") && (users ?? []).length > 0,
    queryFn: () => lookupFn({ data: { user_ids: (users ?? []).slice(0, 100).map((u) => u.id) } }),
  });
  const emailOf = (id: string) => (identities ?? []).find((i) => i.id === id)?.email ?? null;

  return (
    <RequireCapability
      anyOf={["roles.view", "finance.view", "users.view", "promo.manage"]}
      title="Admin Dashboard"
      subtitle="Manage users and platform health."
    >
      {can("finance.view") && (
        <>
          <RevenueReportsCard />
          <div className="h-6" />
          <CompanyRevenueCard />
          <div className="h-6" />
        </>
      )}

      {can("platform.analytics") && (
        <>
          <OpenMatchesCard />
          <div className="h-6" />
        </>
      )}

      {can("finance.payouts") && (
        <>
          <PayoutsCard />
          <div className="h-6" />
        </>
      )}

      {can("roles.view") && (
        <>
          <RolesCard />
          <div className="h-6" />
        </>
      )}

      {can("promo.manage") && (
        <>
          <PromoCodesCard />
          <div className="h-6" />
        </>
      )}

      {can("finance.wallet_adjust") && <AdminAdjustWalletCard />}

      {can("roles.manage_privileged") && (
        <>
          <div className="h-6" />
          <CloseAccountCard />
        </>
      )}

      {can("users.view") && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-right">XP</th>
                <th className="px-4 py-3 text-right">Reputation</th>
                <th className="px-4 py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="px-4 py-3"><div className="font-medium">{u.display_name ?? u.username}</div><div className="text-xs text-muted-foreground">@{u.username}</div></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {emailOf(u.id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.rank_tier}</td>
                  <td className="px-4 py-3 text-right">{u.xp}</td>
                  <td className="px-4 py-3 text-right">{u.reputation}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RequireCapability>
  );
}

type PromoCodeRow = {
  id: string;
  code: string;
  amount_cents: number;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

function PromoCodesCard() {
  const createFn = useServerFn(adminCreatePromoCode);
  const listFn = useServerFn(adminListPromoCodes);
  const toggleFn = useServerFn(adminTogglePromoCode);
  const qc = useQueryClient();

  const { data: codes, isLoading } = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: () => listFn() as Promise<PromoCodeRow[]>,
  });

  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          code: code.trim(),
          amount_cents: Math.round(Number(amount) * 100),
          max_redemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Promo code created.");
      setCode(""); setAmount("10"); setMaxRedemptions("");
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create promo code"),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Gift className="h-4 w-4" /> Promo codes
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Create a code players can redeem once each for a flat wallet credit.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" />
        <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount USD" />
        <Input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Max uses (optional)" />
        <Button
          onClick={() => {
            if (!code.trim()) return toast.error("Enter a code");
            const n = Number(amount);
            if (!n || n <= 0) return toast.error("Enter a valid amount");
            createMut.mutate();
          }}
          disabled={createMut.isPending}
        >
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-surface/50 uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Redeemed</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Loading…</td></tr>
            ) : !codes?.length ? (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">No promo codes yet.</td></tr>
            ) : (
              codes.map((c) => (
                <tr key={c.id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2 text-right">${(c.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{c.redemption_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={c.active ? "border-emerald-500/40 text-emerald-500" : "border-border"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleMut.isPending}
                      onClick={() => toggleMut.mutate({ id: c.id, active: !c.active })}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CLOSE_MODE_COPY = {
  delete: {
    label: "Delete account",
    blurb:
      "This account has never transacted, so there are no financial records to keep. It will be removed entirely.",
  },
  disable: {
    label: "Retire account",
    blurb:
      "This account has a transaction history. Deleting it would erase every deposit, payout and settlement it was part of, so it will be retired instead: sign-in blocked, profile anonymised, ledger kept.",
  },
} as const;

/**
 * Look a player up, see what they hold, then close the account.
 *
 * The order is the point. Closing an account is irreversible and the thing
 * that makes it dangerous is money — a balance owed, or a stake sitting in a
 * live match — so the finances are on screen before the button is reachable,
 * and the button stays dead while either is non-zero. The server refuses on
 * the same conditions; this is the half that stops the mistake being made.
 */
function CloseAccountCard() {
  const summaryFn = useServerFn(adminGetAccountSummary);
  const closeFn = useServerFn(adminCloseAccount);
  const qc = useQueryClient();

  const [target, setTarget] = useState("");
  const [looked, setLooked] = useState<Awaited<ReturnType<typeof adminGetAccountSummary>> | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");

  const lookup = useMutation({
    mutationFn: async () => summaryFn({ data: { target: target.trim() } }),
    onSuccess: (res) => {
      setLooked(res);
      setTyped("");
    },
    onError: (e: Error) => {
      setLooked(null);
      toast.error(e.message || "Couldn't find that player");
    },
  });

  const close = useMutation({
    mutationFn: async () =>
      closeFn({
        data: {
          target: looked!.user_id,
          confirm_username: typed.trim(),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.mode === "delete" ? "Account deleted." : "Account retired.");
      setConfirmOpen(false);
      setLooked(null);
      setTarget("");
      setTyped("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't close that account"),
  });

  const copy = looked ? CLOSE_MODE_COPY[looked.mode] : null;
  const handle = looked?.username ?? "";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserX className="h-4 w-4" /> Close a player account
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Look the player up first. Closing is refused while they hold a balance or have money staked
        in a live match.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="username, email or user id"
          onKeyDown={(e) => {
            if (e.key === "Enter" && target.trim()) lookup.mutate();
          }}
        />
        <Button
          variant="secondary"
          onClick={() => target.trim() && lookup.mutate()}
          disabled={lookup.isPending}
        >
          {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </Button>
      </div>

      {looked && (
        <div className="mt-4 rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">
              {looked.display_name || looked.username || "Unnamed"}
            </span>
            {looked.username && (
              <span className="text-xs text-muted-foreground">@{looked.username}</span>
            )}
            {looked.email && <span className="text-xs text-muted-foreground">{looked.email}</span>}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RevStat label="Balance" value={fmtUsd(looked.balance_cents)} />
            <RevStat
              label="In live matches"
              value={fmtUsd(looked.escrow_cents)}
              sub={looked.escrow_count ? `${looked.escrow_count} held` : "nothing staked"}
            />
            <RevStat label="Ledger rows" value={String(looked.ledger_rows)} />
            <RevStat
              label="Roles"
              value={looked.roles.length ? looked.roles.join(", ") : "player"}
            />
          </div>

          {looked.blocked ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed">
              This account can't be closed yet. It holds {fmtUsd(looked.balance_cents)} and has{" "}
              {fmtUsd(looked.escrow_cents)} staked in live matches. Pay the balance out and let the
              matches settle first — closing now would take money that belongs to them.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy?.blurb}</p>
          )}

          <Input
            className="mt-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional, recorded in the audit log)"
          />

          <Button
            variant="destructive"
            className="mt-3"
            disabled={looked.blocked}
            onClick={() => setConfirmOpen(true)}
          >
            {copy?.label}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.label}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>{copy?.blurb}</p>
                <p>
                  This cannot be undone. Type{" "}
                  <span className="font-mono font-semibold text-foreground">{handle}</span> to
                  confirm.
                </p>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={handle}
                  aria-label="Confirm username"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={close.isPending || typed.trim().toLowerCase() !== handle.toLowerCase()}
              onClick={(e) => {
                e.preventDefault();
                close.mutate();
              }}
            >
              {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : copy?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminAdjustWalletCard() {
  const creditFn = useServerFn(adminCreditWallet);
  const debitFn = useServerFn(adminDebitWallet);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("50");
  // Blank by default now the card runs both directions: a note reading "test
  // credit" on a removal would be worse than no note at all.
  const [note, setNote] = useState("");

  const payload = () => ({
    data: {
      target: target.trim(),
      amount_cents: Math.round(Number(amount) * 100),
      note: note.trim() || undefined,
    },
  });

  const mut = useMutation({
    mutationFn: async () => creditFn(payload()),
    onSuccess: (res) => {
      toast.success(`Credited. New balance: $${(Number(res.balance_cents) / 100).toFixed(2)}`);
    },
    onError: (e: Error) => toast.error(e.message || "Credit failed"),
  });

  // Reversing a credit applied in error. A separate mutation rather than a mode
  // flag on the one above, so the confirm prompt and the failure message can
  // each say which direction the money is actually going.
  const removeMut = useMutation({
    mutationFn: async () => debitFn(payload()),
    onSuccess: (res) => {
      toast.success(`Removed. New balance: $${(Number(res.balance_cents) / 100).toFixed(2)}`);
    },
    onError: (e: Error) => toast.error(e.message || "Removal failed"),
  });

  const busy = mut.isPending || removeMut.isPending;

  const validate = () => {
    if (!target.trim()) {
      toast.error("Enter a user email or id");
      return false;
    }
    const n = Number(amount);
    if (!n || n < 1) {
      toast.error("Enter a valid amount");
      return false;
    }
    return true;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" /> Adjust a wallet
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Admin-only. Add balance to any user (by email or user id), or remove a credit applied in
        error. Either way it records an <code className="rounded bg-muted px-1">adjustment</code>{" "}
        ledger entry the player can see. Removal never takes a balance negative and never touches
        escrowed stakes.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto_auto]">
        <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="user email or uuid" />
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount USD"
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        <Button
          onClick={() => {
            if (validate()) mut.mutate();
          }}
          disabled={busy}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Credit"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!validate()) return;
            const ok = window.confirm(
              `Remove $${Number(amount).toFixed(2)} from ${target.trim()}? This debits their spendable balance and is recorded in the audit log.`,
            );
            if (ok) removeMut.mutate();
          }}
          disabled={busy}
        >
          {removeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
        </Button>
      </div>
    </div>
  );
}

type PayoutRow = {
  id: string;
  user_id: string;
  method: "paypal" | "cashapp";
  speed: "standard" | "same_day";
  handle: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  status: "pending" | "processing" | "paid" | "failed" | "canceled";
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  profiles?: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};

function PayoutsCard() {
  const [speed, setSpeed] = useState<"same_day" | "standard">("same_day");
  const listFn = useServerFn(adminListPayoutRequests);
  const qc = useQueryClient();

  const [sameResult, standardResult] = useQueries({
    queries: [
      {
        queryKey: ["admin-payouts", "same_day"],
        queryFn: () => listFn({ data: { speed: "same_day", limit: 100 } }) as Promise<PayoutRow[]>,
        refetchInterval: 30_000,
      },
      {
        queryKey: ["admin-payouts", "standard"],
        queryFn: () => listFn({ data: { speed: "standard", limit: 100 } }) as Promise<PayoutRow[]>,
        refetchInterval: 30_000,
      },
    ],
  });

  const isFetching = sameResult.isFetching || standardResult.isFetching;
  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin-payouts"] });
  };

  const data = speed === "same_day" ? sameResult.data : standardResult.data;
  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing");
  const history = rows.filter((r) => r.status !== "pending" && r.status !== "processing");
  const owed = pending.reduce((sum, r) => sum + r.net_cents, 0);

  const samePending = (sameResult.data ?? []).filter((r) => r.status === "pending" || r.status === "processing").length;
  const standardPending = (standardResult.data ?? []).filter((r) => r.status === "pending" || r.status === "processing").length;

  const speedLabel = speed === "same_day" ? "Same-day" : "Standard";
  const speedHint = speed === "same_day" ? "30 min – 5 hr SLA" : "2–5 business days SLA";

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border/60 p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Banknote className="h-4 w-4" /> Payout management
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pay the user with the handle shown, then mark the request paid. Rejecting refunds their wallet.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-px bg-border/60 sm:grid-cols-3">
        <Stat label={`Awaiting action`} value={String(pending.length)} sub={speedHint} />
        <Stat label="Total owed" value={`$${(owed / 100).toFixed(2)}`} sub={`${speedLabel} queue`} />
        <Stat label="Recent history" value={String(history.length)} sub="Paid / rejected / failed" />
      </div>

      <div className="p-6">
        <Tabs value={speed} onValueChange={(v) => setSpeed(v as "same_day" | "standard")}>
          <TabsList>
            <TabsTrigger value="same_day" className="flex items-center gap-1.5">
              Same-day
              {samePending > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {samePending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="standard" className="flex items-center gap-1.5">
              Standard
              {standardPending > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {standardPending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={speed} className="mt-5 space-y-6">
            {sameResult.isLoading || standardResult.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading payout requests…
              </div>
            ) : (
              <>
                <PayoutSection
                  title="Awaiting action"
                  count={pending.length}
                  rows={pending}
                  actionable
                  emptyHint="You're all caught up."
                  onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })}
                />
                <PayoutSection
                  title="Recent history"
                  count={history.length}
                  rows={history}
                  actionable={false}
                  emptyHint="No completed payouts yet."
                  onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card px-6 py-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PayoutSection({
  title,
  count,
  rows,
  actionable,
  emptyHint,
  onChanged,
}: {
  title: string;
  count: number;
  rows: PayoutRow[];
  actionable: boolean;
  emptyHint: string;
  onChanged: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <PayoutCard key={r.id} row={r} actionable={actionable} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusBadge(status: PayoutRow["status"]) {
  const map: Record<PayoutRow["status"], { label: string; className: string; icon?: React.ReactNode }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: <Clock className="h-3 w-3" /> },
    processing: { label: "Processing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <Check className="h-3 w-3" /> },
    failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30", icon: <X className="h-3 w-3" /> },
    canceled: { label: "Canceled", className: "bg-muted text-muted-foreground border-border", icon: <X className="h-3 w-3" /> },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={`gap-1 ${s.className}`}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function PayoutCard({ row, actionable, onChanged }: { row: PayoutRow; actionable: boolean; onChanged: () => void }) {
  const updateFn = useServerFn(adminUpdatePayoutRequest);
  const [note, setNote] = useState("");
  const [openNote, setOpenNote] = useState(false);

  const mut = useMutation({
    mutationFn: (action: "mark_processing" | "mark_paid" | "reject") =>
      updateFn({ data: { id: row.id, action, admin_note: note.trim() || undefined } }),
    onSuccess: (res) => {
      toast.success(`Payout ${res.status}.`);
      if ((res as { fee_warning?: string | null }).fee_warning) {
        toast.warning(`Payout marked paid, but the platform fee wasn't recorded: ${(res as { fee_warning?: string | null }).fee_warning}`);
      }
      setNote("");
      setOpenNote(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  const player = row.profiles?.display_name ?? row.profiles?.username ?? row.user_id.slice(0, 8);
  const initials = player.slice(0, 2).toUpperCase();
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-surface/30 transition hover:border-border">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        {/* Left: player + handle */}
        <div className="flex min-w-0 items-center gap-3">
          {row.profiles?.avatar_url ? (
            <img src={row.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{player}</div>
              {statusBadge(row.status)}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {row.profiles?.username && <span>@{row.profiles.username}</span>}
              <span>•</span>
              <span>{timeAgo(row.created_at)}</span>
              <span>•</span>
              <span className="uppercase">{row.method === "paypal" ? "PayPal" : "Cash App"}</span>
            </div>
            <button
              type="button"
              onClick={() => copy(row.handle)}
              className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] hover:bg-black/50"
              title="Copy handle"
            >
              <span className="truncate">{row.handle}</span>
              <Copy className="h-3 w-3 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Middle: amounts */}
        <div className="flex items-center gap-6 md:gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Gross</div>
            <div className="text-sm tabular-nums text-muted-foreground">${(row.amount_cents / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Fee</div>
            <div className="text-sm tabular-nums text-muted-foreground">${(row.fee_cents / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Net to pay</div>
            <div className="text-lg font-semibold tabular-nums text-foreground">${(row.net_cents / 100).toFixed(2)}</div>
          </div>
        </div>

        {/* Right: actions */}
        {actionable && (
          <div className="flex flex-wrap items-center gap-2">
            {row.status === "pending" && (
              <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("mark_processing")}>
                Processing
              </Button>
            )}
            <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate("mark_paid")}>
              {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><Check className="mr-1 h-3.5 w-3.5" /> Mark paid</>)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpenNote((v) => !v)}>
              Reject
            </Button>
          </div>
        )}
      </div>

      {openNote && actionable && (
        <div className="border-t border-border/60 p-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason (admin only)…"
              className="min-h-[60px] flex-1"
            />
            <div className="flex gap-2 md:flex-col">
              <Button size="sm" variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate("reject")}>
                Reject & refund
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenNote(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {!actionable && row.admin_note && (
        <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-semibold">Note:</span> {row.admin_note}
        </div>
      )}
    </div>
  );
}

type StaffRow = {
  user_id: string;
  roles: AppRole[];
  granted_at: string;
  profile: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};

type AuditRow = {
  id: string;
  role: string;
  action: "grant" | "revoke";
  note: string | null;
  created_at: string;
  target: { username?: string | null; display_name?: string | null } | null;
  actor: { username?: string | null; display_name?: string | null } | null;
};

const ROLE_BADGE: Record<AppRole, string> = {
  super_admin: "border-primary/50 bg-primary/10 text-primary-glow",
  admin: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  financial_admin: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  moderator: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  user: "border-border text-muted-foreground",
};

function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

/**
 * Staff & roles.
 *
 * The dropdown only offers roles the signed-in account may actually grant, and
 * that list comes from the SERVER (`adminListStaff` returns it alongside the
 * roster) rather than being derived on the client. An admin sees only
 * "Moderator" here; appointing a financial_admin or another admin is a
 * super_admin action, because an admin who could grant themselves
 * financial_admin would have a two-click path into the treasury.
 */
function RolesCard() {
  // Resetting someone else's second factor is a super_admin power, so the
  // button only renders for one.
  const { can: canDo } = useRoles();
  const canManageSecurity = canDo("security.settings");
  const listFn = useServerFn(adminListStaff);
  const auditFn = useServerFn(adminListRoleAudit);
  const grantFn = useServerFn(adminGrantRole);
  const revokeFn = useServerFn(adminRevokeRole);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => listFn({}) as Promise<{ staff: StaffRow[]; grantable: AppRole[] }>,
  });

  const { data: audit } = useQuery({
    queryKey: ["admin-role-audit"],
    queryFn: () => auditFn({ data: { limit: 25 } }) as Promise<AuditRow[]>,
  });

  /**
   * Module 9. Who has actually enrolled a second factor.
   *
   * Shown here rather than on /security because this is the page where someone
   * decides whether it is safe to switch the treasury 2FA requirement on — that
   * decision is "has everyone who needs it enrolled?", and it should not require
   * asking each of them.
   */
  const mfaFn = useServerFn(listMfaStatus);
  const resetMfaFn = useServerFn(adminResetUserMfa);
  const staffIds = (data?.staff ?? []).map((s) => s.user_id);
  const { data: mfa } = useQuery({
    queryKey: ["staff-mfa", staffIds.join(",")],
    enabled: staffIds.length > 0,
    queryFn: () => mfaFn({ data: { user_ids: staffIds } }),
  });

  const resetMfa = useMutation({
    mutationFn: (userId: string) => resetMfaFn({ data: { user_id: userId } }),
    onSuccess: (r) => {
      toast.success(
        r.removed
          ? `Removed ${r.removed} factor(s). They'll be asked to set it up again.`
          : "That account had no second factor.",
      );
      qc.invalidateQueries({ queryKey: ["staff-mfa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Surfaces drift between src/lib/roles.ts and the seeded role_capabilities
  // table, so a mismatch shows up as a warning rather than as a button that
  // renders but always fails.
  const { data: dbCaps } = useQuery({
    queryKey: ["role-capabilities"],
    queryFn: async () =>
      (await supabase.from("role_capabilities").select("role, capability")).data ?? [],
  });
  const drift = dbCaps?.length ? capabilityMapMatches(dbCaps) : null;

  const grantable = data?.grantable ?? [];
  const staff = data?.staff ?? [];

  const [target, setTarget] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [showMatrix, setShowMatrix] = useState(false);

  const effectiveRole = role || grantable[grantable.length - 1] || "";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-staff"] });
    qc.invalidateQueries({ queryKey: ["admin-role-audit"] });
    qc.invalidateQueries({ queryKey: ["roles"] });
  };

  const grant = useMutation({
    mutationFn: () => grantFn({ data: { target: target.trim(), role: effectiveRole as AppRole } }),
    onSuccess: (res: { roles?: string[] }) => {
      const granted = res.roles ?? [effectiveRole];
      toast.success(
        granted.length > 1
          ? `Granted ${granted.join(" + ")}. Super admin carries admin so existing permission checks keep matching.`
          : `Granted ${granted[0]}.`,
      );
      setTarget("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Grant failed"),
  });

  const revoke = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole }) =>
      revokeFn({ data: { target: vars.userId, role: vars.role } }),
    onSuccess: () => {
      toast.success("Role revoked.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Revoke failed"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" /> Staff &amp; roles
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowMatrix((v) => !v)}>
          {showMatrix ? "Hide" : "Show"} permissions
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Roles attach to a normal player account, no separate login. Operations and finance are
        separate lanes: an admin runs the platform but cannot move money, and a financial admin
        moves money but sees no disputes or tickets.
      </p>

      {drift && !drift.ok && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <p className="font-medium text-amber-200">Permission map is out of sync.</p>
          <p className="mt-1 text-amber-100/80">
            The database and <code className="rounded bg-black/30 px-1">src/lib/roles.ts</code>{" "}
            disagree. Enforcement follows the database, so some buttons may render but fail.
          </p>
          {drift.missingInDb.length > 0 && (
            <p className="mt-1.5 text-amber-100/70">In code only: {drift.missingInDb.join(", ")}</p>
          )}
          {drift.missingLocally.length > 0 && (
            <p className="mt-1 text-amber-100/70">
              In database only: {drift.missingLocally.join(", ")}
            </p>
          )}
        </div>
      )}

      {showMatrix && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-surface/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium uppercase text-muted-foreground">
                  Permission
                </th>
                {APP_ROLES.filter((r) => r !== "user").map((r) => (
                  <th key={r} className="px-3 py-2 text-center">
                    <RoleBadge role={r} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_GROUPS.map((group) => (
                <Fragment key={group.label}>
                  <tr className="border-t border-border/40 bg-surface/20">
                    <td
                      colSpan={5}
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.capabilities.map((cap) => (
                    <tr key={cap} className="border-t border-border/30">
                      <td className="px-3 py-2">{CAPABILITY_LABELS[cap]}</td>
                      {APP_ROLES.filter((r) => r !== "user").map((r) => (
                        <td key={r} className="px-3 py-2 text-center">
                          {ROLE_CAPABILITIES[r].includes(cap) ? (
                            <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grantable.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-surface/30 p-3 text-xs text-muted-foreground">
          You can view the staff list but not change it. Granting a role needs a super admin.
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="username, email, or user id"
            />
            <select
              value={effectiveRole}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="h-10 rounded-md border border-border/60 bg-background px-3 text-sm"
            >
              {grantable.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                if (!target.trim()) return toast.error("Enter a username, email, or id");
                grant.mutate();
              }}
              disabled={grant.isPending}
            >
              {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant role"}
            </Button>
          </div>
          {effectiveRole && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {ROLE_DESCRIPTIONS[effectiveRole as AppRole]}
            </p>
          )}
        </>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-surface/50 uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Roles</th>
              <th className="px-3 py-2 text-left">2FA</th>
              <th className="px-3 py-2 text-left">Since</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Loading…</td></tr>
            ) : !staff.length ? (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">No staff yet.</td></tr>
            ) : (
              staff.map((s) => {
                const isSelf = s.user_id === user?.id;
                const name = s.profile?.display_name ?? s.profile?.username ?? s.user_id.slice(0, 8);
                return (
                  <tr key={s.user_id} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {name} {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                      </div>
                      {s.profile?.username && (
                        <div className="text-[10px] text-muted-foreground">@{s.profile.username}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.roles.map((r) => <RoleBadge key={r} role={r} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {mfa?.[s.user_id]?.enrolled ? (
                        <Status variant="success">On</Status>
                      ) : (
                        <Status variant="default">Off</Status>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(s.granted_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.roles
                          .filter((r) => grantable.includes(r))
                          .map((r) => (
                            <Button
                              key={r}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              disabled={revoke.isPending || isSelf}
                              title={isSelf ? "You can't revoke your own role" : `Revoke ${ROLE_LABELS[r]}`}
                              onClick={() => revoke.mutate({ userId: s.user_id, role: r })}
                            >
                              Revoke {ROLE_LABELS[r].toLowerCase()}
                            </Button>
                          ))}
                        {/* The recovery path for a lost authenticator. Without
                            it, requiring 2FA for treasury would be a one-way
                            door for anyone who changes phone. */}
                        {canManageSecurity && mfa?.[s.user_id]?.enrolled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-orange-300"
                            disabled={resetMfa.isPending}
                            title="Remove their second factor so they can set it up again"
                            onClick={() => resetMfa.mutate(s.user_id)}
                          >
                            Reset 2FA
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Privilege changes
        </div>
        <div className="max-h-64 divide-y divide-border/40 overflow-auto rounded-lg border border-border/60">
          {!audit?.length ? (
            <div className="p-3 text-xs text-muted-foreground">No role changes recorded yet.</div>
          ) : (
            audit.map((a) => {
              const who = (p: AuditRow["actor"]) =>
                p?.display_name ?? (p?.username ? `@${p.username}` : null);
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <span
                      className={
                        a.action === "grant"
                          ? "font-medium text-emerald-400"
                          : "font-medium text-amber-400"
                      }
                    >
                      {a.action === "grant" ? "Granted" : "Revoked"}
                    </span>{" "}
                    <span className="font-mono">{a.role}</span>{" "}
                    {a.action === "grant" ? "to" : "from"}{" "}
                    <span className="font-medium">{who(a.target) ?? "unknown"}</span>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      by {who(a.actor) ?? "system"}
                      {a.note ? ` · ${a.note}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function fmtUsd(cents: number | null | undefined) {
  return `$${(((cents ?? 0) as number) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MATCH_STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-500/10 text-sky-400",
  active: "bg-emerald-500/10 text-emerald-400",
  disputed: "bg-amber-500/10 text-amber-400",
};

/**
 * Live matches and the money on them.
 *
 * Pool and escrow are shown as separate columns because they disagree by
 * design: an `open` match has only the creator's stake held while it waits for
 * an opponent, so its pool is what it WILL be worth and its escrow is what is
 * actually locked today. Collapsing them into one number would overstate the
 * platform's liability by roughly double on every unmatched challenge.
 */
function OpenMatchesCard() {
  const listFn = useServerFn(adminListOpenMatches);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-open-matches"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const matches = data?.matches ?? [];
  const totals = data?.totals;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Open Matches</h2>
          <p className="text-xs text-muted-foreground">
            Every challenge still running, and what is staked on it.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <RevStat label="Open matches" value={String(totals?.count ?? 0)} />
        <RevStat label="Combined pool" value={fmtUsd(totals?.pool_cents)} sub="if all are matched" />
        <RevStat label="Held in escrow" value={fmtUsd(totals?.escrow_cents)} accent sub="locked now" />
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-surface/50 uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Players</th>
              <th className="px-3 py-2 text-left">Game</th>
              <th className="px-3 py-2 text-right">Stake each</th>
              <th className="px-3 py-2 text-right">Pool</th>
              <th className="px-3 py-2 text-right">Escrow</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Opened</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                  No matches are open right now.
                </td>
              </tr>
            ) : (
              matches.map((m) => (
                <tr key={m.id} className="border-t border-border/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.creator}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.opponent ? `vs ${m.opponent}` : "waiting for an opponent"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {m.game_slug}
                    <div className="text-[11px]">{m.platform}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtUsd(m.stake_cents)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtUsd(m.pool_cents)}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">
                    {fmtUsd(m.escrow_cents)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        MATCH_STATUS_STYLES[m.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{timeAgo(m.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Every `_source` value the fee ledger is written with. Kept beside the card
 * that renders it so a new fee source shows up as a readable row rather than a
 * raw enum the first time it is charged.
 */
const SOURCE_LABELS: Record<string, string> = {
  challenge_fee: "1v1 challenge fees",
  tournament_fee: "Tournament fees",
  withdrawal_fee_same_day: "Same-day withdrawal fees",
  withdrawal_fee_standard: "Standard withdrawal fees",
  tournament_unclaimed_prize: "Unclaimed tournament prizes",
  paypal_payout: "PayPal payout fees",
};

/** Rolling window for the daily chart, in days. */
const DAILY_WINDOW = 30;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function RevenueReportsCard() {
  const fetchSummary = useServerFn(getRevenueSummary);
  const fetchBySource = useServerFn(getRevenueBySource);
  const fetchTotals = useServerFn(getPlatformTotals);

  const fetchDaily = useServerFn(getRevenueDaily);

  // "Real time daily" in the sense that matters here: the numbers move on their
  // own while the dashboard is open, instead of showing whatever was true when
  // the page was loaded. A minute is well under how often fees actually land.
  const live = { refetchInterval: 60_000 } as const;

  const summaryQ = useQuery({
    queryKey: ["revenue-summary"],
    queryFn: () => fetchSummary(),
    ...live,
  });
  const bySourceQ = useQuery({
    queryKey: ["revenue-by-source"],
    queryFn: () => fetchBySource(),
    ...live,
  });
  const totalsQ = useQuery({ queryKey: ["platform-totals"], queryFn: () => fetchTotals(), ...live });

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (DAILY_WINDOW - 1));
    return { from: isoDay(from), to: isoDay(to) };
  }, []);

  const dailyQ = useQuery({
    queryKey: ["revenue-daily", range.from, range.to],
    queryFn: () => fetchDaily({ data: range }),
    ...live,
  });

  const s = summaryQ.data;
  const t = totalsQ.data;

  const sourceLabels: Record<string, string> = SOURCE_LABELS;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Revenue Reports</h2>
          <p className="text-xs text-muted-foreground">Platform fee revenue by period, source, and platform-wide totals.</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { summaryQ.refetch(); bySourceQ.refetch(); totalsQ.refetch(); dailyQ.refetch(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <RevStat label="Today" value={fmtUsd(s?.today_cents)} />
        <RevStat label="This week" value={fmtUsd(s?.week_cents)} />
        <RevStat label="This month" value={fmtUsd(s?.month_cents)} />
        <RevStat label="This year" value={fmtUsd(s?.year_cents)} />
        <RevStat label="Lifetime" value={fmtUsd(s?.lifetime_cents)} accent />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RevStat label="Total deposits" value={fmtUsd(t?.total_deposits_cents)} sub={t ? `${t.deposit_count} deposits` : undefined} />
        <RevStat label="Total withdrawals" value={fmtUsd(t?.total_withdrawals_cents)} sub={t ? `${t.withdrawal_count} withdrawals` : undefined} />
        <RevStat label="Total competitions" value={String(t?.total_competitions ?? 0)} sub="1v1 challenges" />
        <RevStat label="Total tournaments" value={String(t?.total_tournaments ?? 0)} />
      </div>

      <div className="mt-5 rounded-xl border border-border/50 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Daily fee revenue · last {DAILY_WINDOW} days
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtUsd(dailyQ.data?.total_cents)} over {dailyQ.data?.event_count ?? 0} fee events
          </div>
        </div>
        <RevenueChart series={dailyQ.data?.series} isLoading={dailyQ.isLoading} />
      </div>

      <div className="mt-5 rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-surface/50 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Revenue by source</div>
        <div className="divide-y divide-border/40">
          {(bySourceQ.data ?? []).length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No fee revenue yet.</div>
          )}
          {(bySourceQ.data ?? []).map((row) => (
            <div key={row.source} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{sourceLabels[row.source] ?? row.source}</div>
                <div className="text-[11px] text-muted-foreground">{row.event_count} events</div>
              </div>
              <div className="font-mono text-success">{fmtUsd(row.total_cents)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Company revenue.
 *
 * The card is `finance.view`, but the two controls inside it are
 * `finance.treasury`. That split is the whole point of the operations/treasury
 * lanes: an admin is meant to SEE what the platform has collected and MOVE none
 * of it. `withdrawCompanyFunds` and `stripePayoutToBank` both require
 * `finance.treasury` on the server, so an admin pressing these was already
 * refused — but offering a button that always fails is its own bug, and it made
 * the lane split look broken when it was only leaking at the UI.
 */
function CompanyRevenueCard() {
  const { can } = useRoles();
  const qc = useQueryClient();
  const fetchWallet = useServerFn(getCompanyWallet);
  const fetchRevenue = useServerFn(listCompanyRevenue);
  const fetchWithdrawals = useServerFn(listCompanyWithdrawals);
  const withdraw = useServerFn(withdrawCompanyFunds);

  const walletQ = useQuery({ queryKey: ["company-wallet"], queryFn: () => fetchWallet() });
  const revenueQ = useQuery({ queryKey: ["company-revenue"], queryFn: () => fetchRevenue({ data: { limit: 25 } }) });
  const wdQ = useQuery({ queryKey: ["company-withdrawals"], queryFn: () => fetchWithdrawals() });

  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(amount || "0") * 100);
      if (!cents || cents <= 0) throw new Error("Enter a valid amount");
      if (!dest.trim()) throw new Error("Enter a destination (bank, PayPal, etc.)");
      return withdraw({ data: { amount_cents: cents, destination: dest.trim(), note: note.trim() || undefined } });
    },
    onSuccess: () => {
      toast.success("Company funds withdrawn");
      setAmount(""); setDest(""); setNote("");
      qc.invalidateQueries({ queryKey: ["company-wallet"] });
      qc.invalidateQueries({ queryKey: ["company-withdrawals"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const w = walletQ.data;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Company Revenue</h2>
          <p className="text-xs text-muted-foreground">Platform & withdrawal fees collected automatically.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { walletQ.refetch(); revenueQ.refetch(); wdQ.refetch(); }}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RevStat label="Available balance" value={fmtUsd(w?.balance_cents)} accent />
        <RevStat label="Lifetime revenue" value={fmtUsd(w?.lifetime_revenue_cents)} />
        <RevStat label="Lifetime withdrawn" value={fmtUsd(w?.lifetime_withdrawn_cents)} />
      </div>

      {can("finance.treasury") ? (
        <>
          <StripePayoutPanel onDone={() => { walletQ.refetch(); wdQ.refetch(); }} />

          <div className="mt-4 rounded-xl border border-border/50 bg-surface/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Record a manual withdrawal / sweep</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
              <Input placeholder="Amount $" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input placeholder="Destination (bank, PayPal, etc.)" value={dest} onChange={(e) => setDest(e.target.value)} />
              <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
                {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ledger-only entry. Use this when you moved funds outside of Stripe.
            </p>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-border/50 bg-surface/30 p-4 text-xs text-muted-foreground">
          Moving this money is a treasury action. A financial admin can pay it out to the bank.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="bg-surface/50 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Recent fee events</div>
          <div className="max-h-72 overflow-auto divide-y divide-border/40">
            {(revenueQ.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">No fees yet.</div>}
            {(revenueQ.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div>
                  <div className="font-medium">{r.source}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div className="font-mono text-success">+{fmtUsd(r.amount_cents)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="bg-surface/50 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Recent withdrawals</div>
          <div className="max-h-72 overflow-auto divide-y divide-border/40">
            {(wdQ.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">No withdrawals recorded.</div>}
            {(wdQ.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div>
                  <div className="font-medium">{r.destination}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="font-mono text-destructive">−{fmtUsd(r.amount_cents)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevStat({ label, value, accent, sub }: { label: string; value: string; accent?: boolean; sub?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border/50 bg-surface/30"}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StripePayoutPanel({ onDone }: { onDone: () => void }) {
  const fetchBalance = useServerFn(getStripeBalance);
  const fetchLiabilities = useServerFn(getPlatformLiabilities);
  const payout = useServerFn(stripePayoutToBank);
  const balQ = useQuery({ queryKey: ["stripe-balance"], queryFn: () => fetchBalance() });
  /*
   * The Stripe balance alone cannot answer "how much can I take". It is player
   * deposits and platform fees pooled together, so the panel has to show what
   * is owed beside what is there — otherwise "Sweep all" reads as free money.
   */
  const liabQ = useQuery({ queryKey: ["platform-liabilities"], queryFn: () => fetchLiabilities() });
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<null | { mode: "all" | "amount"; cents: number }>(null);

  const m = useMutation({
    mutationFn: async (req: { mode: "all" | "amount"; cents: number }) => {
      if (req.mode === "amount") {
        return payout({ data: { amount_cents: req.cents, note: note.trim() || undefined } });
      }
      return payout({ data: { note: note.trim() || undefined } });
    },
    onSuccess: (r: any) => {
      toast.success(`Stripe payout initiated · ${fmtUsd(r.amount_cents)} · ${r.status}`);
      if (r.ledger_warning) toast.warning(`Ledger note: ${r.ledger_warning}`);
      if (r.email_warning) toast.warning(`Email note: ${r.email_warning}`);
      else toast.message("Confirmation email queued to admin inbox");
      setAmount(""); setNote("");
      balQ.refetch();
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Payout failed"),
  });

  const obligationsCents = liabQ.data?.obligations_cents ?? 0;
  const usd = (balQ.data?.available ?? []).find((b: any) => b.currency === "usd");
  const pendingUsd = (balQ.data?.pending ?? []).find((b: any) => b.currency === "usd");
  const live = balQ.data?.livemode;

  const sweepableCents = Math.max(0, (usd?.amount ?? 0) - obligationsCents);

  function requestPayout(mode: "all" | "amount") {
    if (mode === "amount") {
      const cents = Math.round(parseFloat(amount || "0") * 100);
      if (!cents || cents <= 0) {
        toast.error("Enter a valid amount");
        return;
      }
      if (usd?.amount != null && cents > usd.amount) {
        toast.error(`Amount exceeds available balance (${fmtUsd(usd.amount)})`);
        return;
      }
      // Above the safe line is refused by the server unless overridden, so say
      // so here rather than letting them find out from a failed payout.
      if (cents > sweepableCents) {
        toast.error(
          `Only ${fmtUsd(sweepableCents)} is yours. ${fmtUsd(obligationsCents)} of the balance is owed to players.`,
        );
        return;
      }
      setPending({ mode, cents });
    } else {
      // All of OURS, not all of the account's.
      const cents = sweepableCents;
      if (!cents || cents <= 0) {
        toast.error("No available USD balance to sweep");
        return;
      }
      setPending({ mode, cents });
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Withdraw to bank · Stripe payout</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sends real cash from your Stripe balance to your default linked bank account.
            {live === false ? " (Test mode)" : live ? " (Live mode)" : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => balQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RevStat label="Stripe available" value={fmtUsd(usd?.amount)} />
        <RevStat label="Stripe pending" value={fmtUsd(pendingUsd?.amount)} />
        <RevStat label="Owed to players" value={fmtUsd(obligationsCents)} />
        <RevStat label="Yours to sweep" value={fmtUsd(sweepableCents)} accent />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        The Stripe balance holds player deposits and platform fees together. Only the last figure is
        the platform's, and <b className="text-foreground">Sweep all</b> takes that rather than the
        whole balance.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto_auto]">
        <Input placeholder="Amount $" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={() => requestPayout("amount")} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw to bank"}
        </Button>
        <Button variant="outline" onClick={() => requestPayout("all")} disabled={m.isPending || sweepableCents <= 0}>
          Sweep all
        </Button>
      </div>
      {balQ.error ? (
        <p className="mt-2 text-[11px] text-destructive">{(balQ.error as any)?.message ?? "Failed to load Stripe balance"}</p>
      ) : null}

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bank payout</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to move real funds from your Stripe balance to your linked business bank account.
              {live === false ? " (Test mode, no real money will move.)" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-border/60 bg-surface/40 p-4 text-sm">
            <Row label="Payout amount" value={fmtUsd(pending?.cents)} bold />
            <Row label="Currency" value="USD" />
            <Row label="Stripe available" value={fmtUsd(usd?.amount)} />
            <Row label="Stripe pending" value={fmtUsd(pendingUsd?.amount)} />
            <Row
              label="Balance after"
              value={fmtUsd(Math.max(0, (usd?.amount ?? 0) - (pending?.cents ?? 0)))}
            />
            {pending?.mode === "all" ? (
              <p className="mt-2 text-xs text-muted-foreground">Sweeping the entire available USD balance.</p>
            ) : null}
            {note.trim() ? (
              <Row label="Note" value={note.trim()} />
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              A confirmation email will be sent to the admin inbox, and follow-up emails will be sent when Stripe marks the payout as in transit, paid, or failed.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pending) return;
                m.mutate(pending, {
                  onSettled: () => setPending(null),
                });
              }}
            >
              {m.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending…</span>
              ) : (
                `Send ${fmtUsd(pending?.cents)} to bank`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={bold ? "text-base font-semibold" : "text-sm"}>{value}</span>
    </div>
  );
}

