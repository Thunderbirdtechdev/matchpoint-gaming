import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Banknote, ExternalLink, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  getMyWallet,
  createDepositCheckout,
  createConnectOnboarding,
  createCashout,
} from "@/lib/wallet.functions";
import { savePaypalEmail, createPaypalCashout } from "@/lib/paypal.functions";

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
  const onboard = useServerFn(createConnectOnboarding);
  const cashout = useServerFn(createCashout);
  const savePaypal = useServerFn(savePaypalEmail);
  const paypalCashout = useServerFn(createPaypalCashout);

  const [depositAmount, setDepositAmount] = useState("25");
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalAmount, setPaypalAmount] = useState("");

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
    if (search.connect === "return") {
      toast.success("Payout account updated.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    }
  }, [search.deposit, search.connect, qc]);

  const depositMut = useMutation({
    mutationFn: async (amount_cents: number) => deposit({ data: { amount_cents } }),
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start deposit"),
  });

  const onboardMut = useMutation({
    mutationFn: async () => onboard(),
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start onboarding"),
  });

  const cashoutMut = useMutation({
    mutationFn: async (amount_cents: number) => cashout({ data: { amount_cents } }),
    onSuccess: () => {
      toast.success("Cash-out initiated.");
      setCashoutAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "Cash-out failed"),
  });

  const savePaypalMut = useMutation({
    mutationFn: async (email: string) => savePaypal({ data: { paypal_email: email } }),
    onSuccess: () => {
      toast.success("PayPal email saved.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save PayPal email"),
  });

  const paypalMut = useMutation({
    mutationFn: async (amount_cents: number) => paypalCashout({ data: { amount_cents } }),
    onSuccess: () => {
      toast.success("PayPal payout sent.");
      setPaypalAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "PayPal payout failed"),
  });

  const balance = data?.wallet?.balance_cents ?? 0;
  const connect = data?.connect;
  const savedPaypal = data?.paypal_email ?? null;
  const payoutsReady = !!connect?.payouts_enabled;
  useEffect(() => {
    if (savedPaypal && !paypalEmail) setPaypalEmail(savedPaypal);
  }, [savedPaypal, paypalEmail]);

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

        {/* Cash out / Connect */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Banknote className="h-4 w-4" /> Cash out
          </div>
          {!connect ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Connect a payout account (bank) to withdraw winnings to your bank.
              </p>
              <Button className="mt-4 w-full" onClick={() => onboardMut.mutate()} disabled={onboardMut.isPending}>
                {onboardMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Set up payouts <ExternalLink className="ml-2 h-4 w-4" /></>}
              </Button>
            </>
          ) : !payoutsReady ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Finish verifying your payout account to enable cash-outs.
              </p>
              <Button className="mt-4 w-full" variant="outline" onClick={() => onboardMut.mutate()} disabled={onboardMut.isPending}>
                {onboardMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue verification <ExternalLink className="ml-2 h-4 w-4" /></>}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-muted-foreground">Withdraw to your verified bank account.</p>
              <div className="mt-3 flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={balance / 100}
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  placeholder="Amount USD"
                />
                <Button
                  onClick={() => {
                    const n = Number(cashoutAmount);
                    if (!n || n < 1) return toast.error("Enter a valid amount");
                    const cents = Math.round(n * 100);
                    if (cents > balance) return toast.error("Exceeds balance");
                    cashoutMut.mutate(cents);
                  }}
                  disabled={cashoutMut.isPending || balance <= 0}
                >
                  {cashoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Available: {fmt(balance)}</p>
            </>
          )}
        </div>
      </div>

      {/* PayPal cash-out */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4" /> Cash out to PayPal
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Send funds directly to your PayPal account. A 2% platform fee (min $0.25) is deducted from each payout.
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
            disabled={!savedPaypal}
          />
          <Button
            onClick={() => {
              if (!savedPaypal) return toast.error("Save your PayPal email first");
              const n = Number(paypalAmount);
              if (!n || n < 1) return toast.error("Enter a valid amount");
              const cents = Math.round(n * 100);
              if (cents > balance) return toast.error("Exceeds balance");
              paypalMut.mutate(cents);
            }}
            disabled={paypalMut.isPending || balance <= 0 || !savedPaypal}
          >
            {paypalMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to PayPal"}
          </Button>
        </div>
        {paypalAmount && Number(paypalAmount) > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            You'll receive {fmt(Math.max(0, Math.round(Number(paypalAmount) * 100) - Math.max(Math.round(Number(paypalAmount) * 100 * 0.02), 25)))} after fee.
          </p>
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
              const credit = t.amount_cents >= 0;
              return (
                <li key={t.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    {credit ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" /> : <ArrowUpCircle className="h-4 w-4 text-rose-500" />}
                    <div>
                      <div className="font-medium capitalize">{txLabel(t.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} {t.description ? `· ${t.description}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className={credit ? "font-medium text-emerald-500" : "font-medium text-rose-500"}>
                    {credit ? "+" : ""}{fmt(t.amount_cents)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
