// The imprint and privacy notice are pages of the tool itself (/imprint,
// /privacy, text supplied by atares). A deployment can still point them
// elsewhere with VITE_IMPRINT_URL / VITE_PRIVACY_URL.

const env = import.meta.env as Record<string, string | undefined>;

export function imprintUrl(): string {
  return env.VITE_IMPRINT_URL_DE || env.VITE_IMPRINT_URL || '/imprint';
}

export function privacyUrl(): string {
  return env.VITE_PRIVACY_URL_DE || env.VITE_PRIVACY_URL || '/privacy';
}

export const ATARES_HOME = 'https://atares.team';

/** Contact address for "Gespräch vereinbaren". */
export const CONTACT_EMAIL = 'exitiq@atares.team';

/**
 * mailto link with a short, neutral pre-filled message. It deliberately
 * contains no answers or results: what to share stays the user's choice.
 */
export function contactMailto(): string {
  const subject = 'ExitIQ: Gespräch zu meinem Maßnahmenplan';
  const body = 'Guten Tag,\n\nich habe die ExitIQ-Selbsteinschätzung abgeschlossen und würde die Ergebnisse und offenen Punkte gerne mit Ihnen besprechen.\n\nMit freundlichen Grüßen\n';
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
