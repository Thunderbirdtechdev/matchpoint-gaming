/**
 * Age and jurisdiction rules for competing for real money.
 *
 * This is a SELF-ATTESTED gate: the player states their date of birth and
 * country and we hold them to it. It stops casual under-age signups and blocks
 * jurisdictions we will not serve, but it is not document KYC and should not be
 * treated as legally sufficient on its own — `player_verification.identity_status`
 * exists for a Stripe Identity flow to fill in later.
 */

export const MIN_AGE = 18;

/** Countries we will not accept players from at all. */
export const BLOCKED_COUNTRIES: Readonly<Record<string, string>> = {
  AF: "Afghanistan",
  BY: "Belarus",
  CU: "Cuba",
  IR: "Iran",
  KP: "North Korea",
  MM: "Myanmar",
  RU: "Russia",
  SD: "Sudan",
  SY: "Syria",
  VE: "Venezuela",
};

/** Countries offered in the onboarding picker. */
export const SUPPORTED_COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IN", name: "India" },
];

/** Whole years elapsed between `dob` and `at` — calendar-correct, not 365-day maths. */
export function ageInYears(dob: string | Date, at: Date = new Date()): number {
  const birth = dob instanceof Date ? dob : new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return Number.NaN;

  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

export function checkEligibility(dob: string, country: string): EligibilityResult {
  const age = ageInYears(dob);

  if (Number.isNaN(age)) {
    return { eligible: false, reason: "That date of birth isn't valid." };
  }
  if (age < 0 || age > 120) {
    return { eligible: false, reason: "That date of birth isn't valid." };
  }
  if (age < MIN_AGE) {
    return {
      eligible: false,
      reason: `You must be at least ${MIN_AGE} to compete for real money on MatchPoint.`,
    };
  }
  if (BLOCKED_COUNTRIES[country]) {
    return {
      eligible: false,
      reason: `MatchPoint isn't available in ${BLOCKED_COUNTRIES[country]} yet.`,
    };
  }
  if (!SUPPORTED_COUNTRIES.some((c) => c.code === country)) {
    return { eligible: false, reason: "Please choose a supported country." };
  }
  return { eligible: true };
}
