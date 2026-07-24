import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2, Landmark, Zap, CalendarClock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getMyWallet,
  createDepositCheckout,
  createConnectOnboarding,
  createCashout,
} from "@/lib/wallet.functions";
import { calculateWithdrawalFee, type WithdrawalSpeed } from "@/lib/fees";

type SearchParams = { deposit?: string; connect?: string };

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — MatchPoint" }] }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    deposit: typeof s.deposit === "string" ? s.deposit : undefined,
    connect: typeof s.connect === "string" ? s.connect : undefined,
  }),
  component: WalletPage,
});

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function txLabel(t: string) {
  return t.replace(/_/g, " ");
}

function WalletPage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/wallet" });
  const fetchWallet = useServerFn(getMyWallet);
  const deposit = useServerFn(createDepositCheckout);
  const connectOnboarding = useServerFn(createConnectOnboarding);
  const cashout = useServerFn(createCashout);

  const [depositAmount, setDepositAmount] = useState("25");
  const [speed, setSpeed] = useState<WithdrawalSpeed>("standard");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
  });

  useEffect(() => {
    if (search.deposit === "success") {
      toast.success("Deposit received — your balance will update shortly.");
      const id = setInterval(() => qc.invalidateQueries({ queryKey: ["wallet"] }), 2000);
      const stop = setTimeout(() => clearInterval(id), 12000);
      return () => { clearInterval(id); clearTimeout(stop); };
    }
    if (search.deposit === "cancel") toast.message("Deposit canceled.");
  }, [search.deposit, qc]);

  useEffect(() => {
    if (search.connect === "return") {
      toast.success("Payout account setup received — checking status…");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    }
    if (search.connect === "refresh") {
      toast.message("Payout setup link expired — start again below.");
    }
  }, [search.connect, qc]);

  const depositMut = useMutation({
    mutationFn: async (amount_cents: number) => deposit({ data: { amount_cents } }),
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start deposit"),
  });

  const connectMut = useMutation({
    mutationFn: async () => connectOnboarding(),
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start payout setup"),
  });

  const payoutMut = useMutation({
    mutationFn: async (amount_cents: number) => cashout({ data: { amount_cents, speed } }),
    onSuccess: (res) => {
      toast.success(
        speed === "same_day"
          ? "Same-day cash out sent — typically arrives in 30 minutes to 5 hours."
          : "Standard cash out sent — typically arrives in 2–5 business days.",
      );
      if (res.fee_warning) {
        toast.warning(`Cash out sent, but the platform fee wasn't recorded: ${res.fee_warning}`);
      }
      setPayoutAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "Cash out failed"),
  });

  const balance = data?.wallet?.balance_cents ?? 0;
  const payoutsEnabled = !!data?.connect?.payouts_enabled;


  return (
    <DashboardShell title="Wallet" subtitle="Deposit, track winnings, and cash out.">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balance */}
        <div className="rounded-2xl border border-border/60 bg-gradient-brand p-8 text-primary-foreground">
          <Wallet className="h-7 w-7" />
          <div className="mt-6 text-sm opacity-80">Available balance</div>
          <div className="mt-1 text-4xl font-bold">
            {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : fmt(balance)}
          </div>
          <p className="mt-6 text-xs opacity-70">
            Used to enter tournaments and challenges. Winnings land here automatically.
          </p>
        </div>

        {/* Deposit */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowDownCircle className="h-4 w-4" /> Deposit funds
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Add money via card. Funds available after payment confirms.</p>
          <div className="mt-4 flex gap-2">
            {[10, 25, 50, 100].map((v) => (
              <Button key={v} size="sm" variant={depositAmount === String(v) ? "default" : "outline"} onClick={() => setDepositAmount(String(v))}>
                ${v}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              min={5}
              max={5000}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount USD"
            />
            <Button
              onClick={() => {
                const n = Number(depositAmount);
                if (!n || n < 5) return toast.error("Minimum deposit is $5");
                depositMut.mutate(Math.round(n * 100));
              }}
              disabled={depositMut.isPending}
            >
              {depositMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deposit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Cash out — automatic via Stripe, no admin approval */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArrowUpCircle className="h-4 w-4" /> Cash out
        </div>

        {!payoutsEnabled ? (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Connect a bank account to cash out — a quick, secure setup through Stripe (the same processor you deposit with).
              Once connected, withdrawals are automatic — no approval needed.
            </p>
            <Button className="mt-4" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
              {connectMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Landmark className="mr-2 h-4 w-4" /> {data?.connect ? "Finish payout setup" : "Set up payouts"}
                </>
              )}
            </Button>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Handled securely by Stripe — MatchPoint never sees your bank details.
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Cash out automatically to your linked bank account. <span className="font-medium text-foreground">Standard</span>{" "}
              payouts are <span className="font-medium text-foreground">free</span> and arrive in 2–5 business days.
              <span className="font-medium text-foreground"> Same-day</span> payouts land in 30 minutes – 5 hours for a small fee.
            </p>

            {/* Speed selector */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSpeed("standard")}
                className={`rounded-lg border p-3 text-left text-xs transition ${
                  speed === "standard"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Standard
                  <span className="ml-auto text-emerald-500">FREE</span>
                </div>
                <div className="mt-1 text-muted-foreground">2–5 business days</div>
              </button>
              <button
                type="button"
                onClick={() => setSpeed("same_day")}
                className={`rounded-lg border p-3 text-left text-xs transition ${
                  speed === "same_day"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Zap className="h-3.5 w-3.5" /> Same-day
                  <span className="ml-auto text-muted-foreground">Fee applies</span>
                </div>
                <div className="mt-1 text-muted-foreground">30 minutes – 5 hours</div>
              </button>
            </div>

            {/* Amount */}
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                type="number"
                min={10}
                max={balance / 100}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Amount USD (min $10)"
              />
              <Button
                onClick={() => {
                  const n = Number(payoutAmount);
                  if (!n || n < 10) return toast.error("Minimum cash out is $10");
                  const cents = Math.round(n * 100);
                  if (cents > balance) return toast.error("Exceeds balance");
                  setConfirmOpen(true);
                }}
                disabled={payoutMut.isPending || balance < 1_000}
              >
                {payoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cash out"}
              </Button>
            </div>

            {payoutAmount && Number(payoutAmount) > 0 && (() => {
              const gross = Math.round(Number(payoutAmount) * 100);
              const b = calculateWithdrawalFee(gross, speed);
              return (
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Withdraw amount</span><span className="font-medium">{fmt(b.grossCents)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {speed === "same_day" ? "Same-day fee" : "Standard fee"}
                    </span>
                    <span className={b.feeCents > 0 ? "font-medium text-rose-500" : "font-medium text-emerald-500"}>
                      {b.feeCents > 0 ? `−${fmt(b.feeCents)}` : "FREE"}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border/60 pt-1"><span>You'll receive</span><span className="font-semibold text-emerald-500">{fmt(b.netCents)}</span></div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{b.etaLabel}</div>
                </div>
              );
            })()}
          </>
        )}
      </div>





      {/* Transactions */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-6 py-4 text-sm font-medium">Recent activity</div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !data?.transactions.length ? (
          <div className="p-6 text-sm text-muted-foreground">No transactions yet. Deposit funds to get started.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.transactions.map((t) => {
              const meta = (t.metadata as Record<string, unknown> | null) ?? {};
              const feeCents = typeof meta.fee_cents === "number" ? meta.fee_cents : null;
              const netCents = typeof meta.net_cents === "number" ? meta.net_cents : null;
              const recipient = typeof meta.recipient_email === "string" ? meta.recipient_email : null;
              // platform_fee ledger rows have amount_cents = 0 because the fee is bundled
              // into the withdrawal debit. Surface the collected fee from metadata so the
              // row doesn't render as $0.00.
              const isFeeRow = t.type === "platform_fee";
              const displayCents = isFeeRow && feeCents !== null ? -feeCents : t.amount_cents;
              const credit = displayCents >= 0;
              return (
                <li key={t.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    {credit ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" /> : <ArrowUpCircle className="h-4 w-4 text-rose-500" />}
                    <div>
                      <div className="font-medium capitalize">{txLabel(t.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} {t.description ? `· ${t.description}` : ""}
                      </div>
                      {!isFeeRow && feeCents !== null && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Fee {fmt(feeCents)}
                          {netCents !== null && <> · Net {fmt(netCents)}</>}
                          {recipient && <> · → {recipient}</>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={credit ? "font-medium text-emerald-500" : "font-medium text-rose-500"}>
                      {credit ? "+" : ""}{fmt(displayCents)}
                    </div>
                    <div className="text-[11px] text-muted-foreground capitalize">{t.status}</div>
                  </div>
                </li>
              );
            })}

          </ul>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {speed === "same_day" ? "same-day" : "standard"} cash out
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {(() => {
                const gross = Math.round(Number(payoutAmount || 0) * 100);
                const b = calculateWithdrawalFee(gross, speed);
                return (
                  <div className="space-y-3 text-sm">
                    <p>Send funds to your connected bank account?</p>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Withdraw amount</span><span className="font-medium">{fmt(b.grossCents)}</span></div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {speed === "same_day" ? "Same-day fee" : "Standard fee"}
                        </span>
                        <span className={b.feeCents > 0 ? "font-medium text-rose-500" : "font-medium text-emerald-500"}>
                          {b.feeCents > 0 ? `−${fmt(b.feeCents)}` : "FREE"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-border/60 pt-1"><span>You'll receive</span><span className="font-semibold text-emerald-500">{fmt(b.netCents)}</span></div>
                    </div>
                    <p className="text-xs text-muted-foreground">{b.etaLabel}.</p>
                  </div>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payoutMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={payoutMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                const cents = Math.round(Number(payoutAmount) * 100);
                payoutMut.mutate(cents, { onSettled: () => setConfirmOpen(false) });
              }}
            >
              {payoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardShell>
  );
}

