import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { confirmEligibility } from "@/lib/profile.functions";
import { MIN_AGE, SUPPORTED_COUNTRIES } from "@/lib/eligibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EligibilityCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmEligibility);
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: verification, isLoading } = useQuery({
    queryKey: ["verification", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_verification")
        .select("date_of_birth, country, age_confirmed_at, identity_status")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const confirmed = !!verification?.age_confirmed_at;

  async function submit() {
    if (!dob || !country) {
      toast.error("Enter your date of birth and country.");
      return;
    }
    setSaving(true);
    try {
      const res = await confirmFn({ data: { date_of_birth: dob, country } });
      if (res.eligible) {
        toast.success("Eligibility confirmed — you're clear to compete.");
        qc.invalidateQueries({ queryKey: ["verification", userId] });
      } else {
        toast.error(res.reason);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Eligibility</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-money play requires you to be {MIN_AGE} or over in a supported country.
          </p>
        </div>
        {!isLoading &&
          (confirmed ? (
            <Status variant="success">
              <StatusIndicator />
              <StatusLabel>Verified</StatusLabel>
            </Status>
          ) : (
            <Status variant="warning">
              <StatusIndicator />
              <StatusLabel>Not verified</StatusLabel>
            </Status>
          ))}
      </div>

      {confirmed ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            Confirmed on {new Date(verification!.age_confirmed_at!).toLocaleDateString()}. Your date
            of birth is private and never shown on your public profile.
          </span>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-gradient-brand text-primary-foreground"
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Confirm eligibility
          </Button>
        </div>
      )}
    </div>
  );
}
