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
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2, Mail, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getMyWallet,
  createDepositCheckout,
} from "@/lib/wallet.functions";
import {
  savePayoutHandle,
  requestManualPayout,
  listMyPayoutRequests,
} from "@/lib/payouts.functions";

type SearchParams = { deposit?: string; connect?: string };
type PayoutMethod = "paypal" | "cashapp";

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
  const saveHandle = useServerFn(savePayoutHandle);
  const requestPayout = useServerFn(requestManualPayout);
  const fetchPayouts = useServerFn(listMyPayoutRequests);

  const [depositAmount, setDepositAmount] = useState("25");
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [handle, setHandle] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
  });

  const { data: payouts } = useQuery({
    queryKey: ["my-payout-requests"],
    queryFn: () => fetchPayouts(),
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

  const depositMut = useMutation({
    mutationFn: async (amount_cents: number) => deposit({ data: { amount_cents } }),
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start deposit"),
  });

  const savedPaypal = data?.paypal_email ?? "";
  const savedCashapp = data?.cashapp_tag ?? "";
  const savedHandle = method === "paypal" ? savedPaypal : savedCashapp;

  useEffect(() => {
    setHandle(savedHandle ?? "");
  }, [method, savedHandle]);

  const saveHandleMut = useMutation({
    mutationFn: async () => saveHandle({ data: { method, handle: handle.trim() } }),
    onSuccess: () => {
      toast.success(method === "paypal" ? "PayPal email saved." : "Cash App $cashtag saved.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const payoutMut = useMutation({
    mutationFn: async (amount_cents: number) =>
      requestPayout({ data: { method, amount_cents, handle: handle.trim() } }),
    onSuccess: () => {
      toast.success("Payout requested — typically paid in 2–24 hours.");
      setPayoutAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-payout-requests"] });
    },
    onError: (e: Error) => toast.error(e.message || "Payout request failed"),
  });

  const balance = data?.wallet?.balance_cents ?? 0;


  return (
    <DashboardShell title="Wallet" subtitle="Deposit, track winnings, and cash out.">
      <div className="grid gap-6 lg:grid-cols-3">
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

        {/* Cash out / Bank — paused */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 opacity-70">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Banknote className="h-4 w-4" /> Bank cash out
            <span className="ml-auto rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Direct-to-bank payouts via Stripe are temporarily paused while we finalize Connect onboarding.
            Use PayPal or the new crypto cash-out below.
          </p>
          <Button className="mt-4 w-full" disabled variant="outline">
            Set up payouts <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          {connect && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {payoutsReady ? "Your bank account is verified — withdrawals will re-enable soon." : "Verification in progress."}
            </p>
          )}
        </div>
      </div>

      {/* PayPal cash-out */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4" /> Cash out to PayPal
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Send funds directly to your PayPal account. A 5% platform fee (min $0.25) is deducted from each payout.
          Sandbox mode — no real money moves.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="your-paypal@example.com"
          />
          <Button
            variant="outline"
            onClick={() => {
              const v = paypalEmail.trim();
              if (!v) return toast.error("Enter your PayPal email");
              savePaypalMut.mutate(v);
            }}
            disabled={savePaypalMut.isPending || !paypalEmail || paypalEmail === savedPaypal}
          >
            {savePaypalMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : savedPaypal ? "Update email" : "Save email"}
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="number"
            min={1}
            max={balance / 100}
            value={paypalAmount}
            onChange={(e) => setPaypalAmount(e.target.value)}
            placeholder="Amount USD"
            disabled={!paypalEmail.trim()}
          />
          <Button
            onClick={() => {
              const email = paypalEmail.trim();
              if (!email) return toast.error("Enter your PayPal email");
              const n = Number(paypalAmount);
              if (!n || n < 1) return toast.error("Enter a valid amount");
              const cents = Math.round(n * 100);
              if (cents > balance) return toast.error("Exceeds balance");
              setConfirmOpen(true);
            }}
            disabled={paypalMut.isPending || balance <= 0 || !paypalEmail.trim()}
          >
            {paypalMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to PayPal"}
          </Button>
        </div>
        {paypalAmount && Number(paypalAmount) > 0 && (() => {
          const gross = Math.round(Number(paypalAmount) * 100);
          const fee = Math.max(Math.round(gross * 0.05), 25);
          const net = Math.max(0, gross - fee);
          return (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Withdraw amount</span><span className="font-medium">{fmt(gross)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (5%, min $0.25)</span><span className="font-medium text-rose-500">−{fmt(fee)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border/60 pt-1"><span>You'll receive</span><span className="font-semibold text-emerald-500">{fmt(net)}</span></div>
            </div>
          );
        })()}
      </div>

      {/* Crypto cash-out */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          {cryptoCurrency === "BTC" ? <Bitcoin className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
          Cash out to crypto
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          USDC on Base auto-sends instantly (~$0.01 network fee). BTC payouts are queued for fulfillment.
          A 1% platform fee (min $0.25) is deducted from each payout.
        </p>

        <div className="mt-4 flex gap-2">
          {(["USDC", "BTC"] as const).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cryptoCurrency === c ? "default" : "outline"}
              onClick={() => setCryptoCurrency(c)}
            >
              {c === "BTC" ? <Bitcoin className="mr-1 h-3.5 w-3.5" /> : <Coins className="mr-1 h-3.5 w-3.5" />}
              {c}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={cryptoAddr}
            onChange={(e) => setCryptoAddr(e.target.value)}
            placeholder={cryptoCurrency === "USDC" ? "0x… (Base network)" : "bc1… or 1… / 3…"}
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!cryptoAddr.trim()) return toast.error("Enter an address");
              saveAddrMut.mutate();
            }}
            disabled={saveAddrMut.isPending || !cryptoAddr.trim() || cryptoAddr.trim() === savedAddrForCurrency}
          >
            {saveAddrMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAddrForCurrency ? "Update" : "Save"}
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="number"
            min={5}
            max={balance / 100}
            value={cryptoAmount}
            onChange={(e) => setCryptoAmount(e.target.value)}
            placeholder="Amount USD (min $5)"
            disabled={!savedAddrForCurrency}
          />
          <Button
            onClick={() => {
              const n = Number(cryptoAmount);
              if (!n || n < 5) return toast.error("Minimum payout is $5");
              const cents = Math.round(n * 100);
              if (cents > balance) return toast.error("Exceeds balance");
              cryptoMut.mutate(cents);
            }}
            disabled={cryptoMut.isPending || balance <= 0 || !savedAddrForCurrency}
          >
            {cryptoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send ${cryptoCurrency}`}
          </Button>
        </div>

        {cryptoAmount && Number(cryptoAmount) > 0 && (() => {
          const gross = Math.round(Number(cryptoAmount) * 100);
          const fee = Math.max(Math.round(gross * 0.01), 25);
          const net = Math.max(0, gross - fee);
          return (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Withdraw amount</span><span className="font-medium">{fmt(gross)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (1%, min $0.25)</span><span className="font-medium text-rose-500">−{fmt(fee)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border/60 pt-1"><span>You'll receive</span><span className="font-semibold text-emerald-500">≈ {fmt(net)} in {cryptoCurrency}</span></div>
            </div>
          );
        })()}

        {cryptoPayoutHistory && cryptoPayoutHistory.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent crypto payouts</div>
            <ul className="mt-2 space-y-1.5">
              {cryptoPayoutHistory.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()} · {p.currency} · {fmt(p.amount_cents)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={
                      p.status === "sent" ? "text-emerald-500" :
                      p.status === "failed" ? "text-rose-500" :
                      "text-amber-500"
                    }>{p.status}</span>
                    {p.tx_hash && p.network === "base" && (
                      <a
                        href={`https://basescan.org/tx/${p.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        view <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
            <AlertDialogTitle>Confirm PayPal withdrawal</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {(() => {
                const gross = Math.round(Number(paypalAmount || 0) * 100);
                const fee = Math.max(Math.round(gross * 0.05), 25);
                const net = Math.max(0, gross - fee);
                return (
                  <div className="space-y-3 text-sm">
                    <p>Send funds from your wallet to <span className="font-medium">{paypalEmail.trim()}</span>?</p>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Withdraw amount</span><span className="font-medium">{fmt(gross)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (5%, min $0.25)</span><span className="font-medium text-rose-500">−{fmt(fee)}</span></div>
                      <div className="mt-1 flex justify-between border-t border-border/60 pt-1"><span>You'll receive</span><span className="font-semibold text-emerald-500">{fmt(net)}</span></div>
                    </div>
                    <p className="text-xs text-muted-foreground">A receipt will be emailed to you once email is configured for this project.</p>
                  </div>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paypalMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={paypalMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                const cents = Math.round(Number(paypalAmount) * 100);
                paypalMut.mutate(
                  { amount_cents: cents, paypal_email: paypalEmail.trim() },
                  { onSettled: () => setConfirmOpen(false) },
                );
              }}
            >
              {paypalMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm withdrawal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

