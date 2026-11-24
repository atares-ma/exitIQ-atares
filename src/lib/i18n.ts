// ExitIQ is German-only for now (Änderungsliste H5: English is hidden until the
// new wording has been translated). The helpers keep one place for date and
// time formatting per the atares Golden Rules.

export type Lang = 'de';

if (typeof document !== 'undefined') document.documentElement.lang = 'de';

/** Kept so shared components can ask for the language; always German. */
export function useLang(): Lang {
  return 'de';
}

/** Golden Rules dates: 13.11.2026. */
export function formatDate(d: Date = new Date()): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Golden Rules times: 14:30 Uhr. */
export function formatTime(d: Date = new Date()): string {
  return `${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}

/** Golden Rules file names start with the date as YYMMDD. */
export function fileDate(d: Date = new Date()): string {
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
