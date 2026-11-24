// Mouse-over explanations (ST5, Hinweis H3). Terms that only deepen the
// understanding get a tap/hover explanation; terms that decide the answer are
// explained in the question text itself (rule of thumb I8).
//
// The term list follows the click test. The explanations are DRAFTS until
// Florian has reviewed them (H3); they can be edited here without touching
// any component. Matching is case-sensitive on the first occurrence.

export interface GlossaryEntry { term: string; text: string }

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'wiederkehrender Umsätze', text: 'Regelmäßig und vertraglich vereinbart, zum Beispiel Abonnements, Wartungs- oder Rahmenverträge.' },
  { term: 'steuerpflichtig', text: 'Das Land, in dem eine Person oder Gesellschaft ihre Steuern auf den Verkaufserlös zahlt, meist der Wohnsitz oder Sitz.' },
  { term: 'Holding-GmbH', text: 'Eine Gesellschaft, die Anteile an Ihrem Unternehmen hält, statt dass Sie die Anteile direkt halten.' },
  { term: 'Earn-outs', text: 'Ein Teil des Kaufpreises, der erst später und abhängig vom Erfolg des Unternehmens gezahlt wird.' },
  { term: 'Earn-out', text: 'Ein Teil des Kaufpreises, der erst später und abhängig vom Erfolg des Unternehmens gezahlt wird.' },
  { term: 'Rückbeteiligung', text: 'Sie verkaufen und beteiligen sich danach wieder mit einem Teil des Erlöses am Unternehmen.' },
  { term: 'Finanzinvestor', text: 'Ein Investor, zum Beispiel ein Private-Equity-Fonds, der ein Unternehmen kauft, um es weiterzuentwickeln und später wieder zu verkaufen.' },
  { term: 'Beirat', text: 'Ein Gremium, das die Geschäftsführung berät oder überwacht und oft bestimmten Entscheidungen zustimmen muss.' },
  { term: 'Ehepartner', text: 'Je nach Güterstand kann die Zustimmung des Ehepartners nötig sein, wenn ein wesentlicher Teil des Vermögens verkauft wird.' },
  { term: 'bereinigten Zahlen', text: 'Zahlen ohne einmalige Erträge oder Kosten, zum Beispiel ohne einen einmaligen Großauftrag oder eine Abfindung.' },
  { term: 'Szenarien', text: 'Durchgerechnete Fälle, zum Beispiel: Was passiert, wenn der Umsatz 20 % niedriger ausfällt?' },
  { term: 'finanzierten Gegenmaßnahmen', text: 'Maßnahmen, die Sie bei einem Engpass ergreifen würden und deren Finanzierung schon steht, zum Beispiel eine zugesagte Kreditlinie.' },
  { term: 'Meilensteinen', text: 'Feste Zwischenziele mit Termin, an denen Sie den Fortschritt messen.' },
  { term: 'Erfolgskennzahlen', text: 'Zahlen, an denen Sie messen, ob eine Maßnahme wirkt, zum Beispiel Umsatz mit einem neuen Produkt.' },
  { term: 'Wiederkaufquote', text: 'Der Anteil der Kunden, die erneut bei Ihnen kaufen oder ihren Vertrag verlängern.' },
  { term: 'Integration', text: 'Die Eingliederung eines gekauften Unternehmens in Ihre Abläufe, Systeme und Organisation.' },
  { term: 'Befugnisse', text: 'Wer was entscheiden und unterschreiben darf, zum Beispiel über Prokura oder Freigabegrenzen.' },
  { term: 'Pensionszusagen', text: 'Zusagen des Unternehmens auf eine Betriebsrente. Käufer ziehen sie meist wie Schulden vom Kaufpreis ab.' },
  { term: 'Betriebsprüfung', text: 'Eine Prüfung des Unternehmens durch das Finanzamt.' },
  { term: 'Gesellschafterliste', text: 'Die beim Handelsregister hinterlegte Liste, wem welche Anteile gehören.' },
  { term: 'Standardlizenzen', text: 'Übliche Lizenzen für gekaufte Software, zum Beispiel für Office-Programme, die jeder Kunde zu gleichen Bedingungen erhält.' },
  { term: 'Lizenzen', text: 'Vereinbarungen, die Ihnen erlauben, Software, Marken oder Inhalte anderer zu nutzen.' },
  { term: 'gekündigt', text: 'Manche Verträge erlauben eine Kündigung, wenn der Eigentümer wechselt (Kontrollwechselklausel).' },
  { term: 'drohende Streitigkeiten', text: 'Konflikte, die noch nicht vor Gericht sind, aber dorthin führen könnten, zum Beispiel eine angekündigte Forderung.' },
  { term: 'Datenschutzregeln', text: 'Vor allem die Datenschutz-Grundverordnung (DSGVO), zum Beispiel für Kunden- und Mitarbeiterdaten.' },
  { term: 'Anzeigen', text: 'Mitteilungen an eine Behörde, die bei einem Eigentümerwechsel nötig sein können.' },
  { term: 'M&A-Berater', text: 'Ein Berater, der Unternehmensverkäufe begleitet, Käufer anspricht und die Verhandlungen führt.' },
  { term: 'Organschaft', text: 'Eine steuerliche Verbindung zwischen Mutter- und Tochtergesellschaft, die beim Verkauf endet.' },
  { term: 'Working Capital', text: 'Das im laufenden Geschäft gebundene Geld, vor allem Forderungen und Vorräte abzüglich Verbindlichkeiten.' },
  { term: 'Sperrfristen', text: 'Fristen nach einer Umstrukturierung, innerhalb derer ein Verkauf zu Steuernachzahlungen führen kann.' },
  { term: 'Wandeldarlehen', text: 'Ein Darlehen, das unter bestimmten Bedingungen in Anteile umgewandelt wird.' },
  { term: 'Vorzugsrechten', text: 'Rechte einzelner Investoren, bei einem Verkauf zuerst oder mehr Geld zu erhalten.' },
];

export type TextPart = string | { term: string; text: string };

/** Splits a text into plain parts and glossary terms (first occurrence of each term, longest terms first). */
export function withTerms(text: string): TextPart[] {
  const entries = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length);
  let parts: TextPart[] = [text];
  const used = new Set<string>();
  for (const e of entries) {
    if (used.has(e.text)) continue;
    const next: TextPart[] = [];
    let done = false;
    for (const p of parts) {
      if (done || typeof p !== 'string') { next.push(p); continue; }
      const i = p.indexOf(e.term);
      // Whole-word-ish match: the term must not be glued to letters on either side.
      const before = i > 0 ? p[i - 1] : ' ';
      const after = p[i + e.term.length] ?? ' ';
      if (i < 0 || /[A-Za-zÄÖÜäöüß-]/.test(before) || /[A-Za-zÄÖÜäöüß]/.test(after)) { next.push(p); continue; }
      if (i > 0) next.push(p.slice(0, i));
      next.push({ term: e.term, text: e.text });
      if (i + e.term.length < p.length) next.push(p.slice(i + e.term.length));
      done = true;
      used.add(e.text);
    }
    parts = next;
  }
  return parts;
}
