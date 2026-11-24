// Question catalogue after the rebuild (Änderungsliste 22/23 Nov 2026,
// sections 5–8). Single source of truth: the SQL seed is generated from it
// (npm run gen:catalogue-sql).
//
// Domains, local weights and the 0/50/100 points stay as before; the only
// weight change is Q25 (now 3, it absorbs Q27). Q27, Q30, Q40, Q42, Q43 and
// Q51 are gone as questions (Q30/Q40/Q42/Q43 became checklist items, see
// plan.ts); Q56/Q57 are never built.

import type { Contributors, DimensionKey, DomainKey, Profile, QuestionDef, QuestionText, RouteCode, StatusType } from './types';

export const CATALOGUE_VERSION = 'catalogue-2026.11-v2.0';
export const SCORING_VERSION = 'scoring-2.0.0';
export const REPORT_VERSION = 'report-2.0.0';

export const DIMENSIONS: { key: DimensionKey; name: string; domains: DomainKey[] }[] = [
  { key: 'S', name: 'Strategische Klarheit', domains: ['S1', 'S2', 'S3'] },
  { key: 'O', name: 'Operative Übertragbarkeit', domains: ['O1', 'O2', 'O3', 'O4', 'O5'] },
  { key: 'T', name: 'Transaktionsvorbereitung', domains: ['T1', 'T2', 'T3', 'T4'] },
];

export const DIMENSION_NAME: Record<DimensionKey, string> = { S: 'Strategische Klarheit', O: 'Operative Übertragbarkeit', T: 'Transaktionsvorbereitung' };

export const DOMAIN_NAMES: Record<DomainKey, string> = {
  S1: 'Ziele und Umfang',
  S2: 'Einigkeit und Befugnisse',
  S3: 'Optionen und Zukunftsplan',
  O1: 'Wirtschaftlichkeit und Liquidität',
  O2: 'Umsatz- und Lieferstabilität',
  O3: 'Kontinuität bei Personen und Beziehungen',
  O4: 'Systeme und Umsetzungskapazität',
  O5: 'Wettbewerbsposition',
  T1: 'Finanzielle Vorbereitung',
  T2: 'Steuerliche Vorbereitung',
  T3: 'Eigentum und Rechte',
  T4: 'Prozessdurchführung',
};

/** Domain percentages per perspective, unchanged (BW1). Each dimension sums to 100. */
export const PROFILE_WEIGHTS: Record<Profile, Record<DomainKey, number>> = {
  OWNER: { S1: 35, S2: 35, S3: 30, O1: 25, O2: 20, O3: 25, O4: 15, O5: 15, T1: 25, T2: 25, T3: 25, T4: 25 },
  CORPORATE: { S1: 30, S2: 35, S3: 35, O1: 25, O2: 15, O3: 25, O4: 25, O5: 10, T1: 20, T2: 25, T3: 25, T4: 30 },
  PE: { S1: 30, S2: 30, S3: 40, O1: 30, O2: 20, O3: 20, O4: 15, O5: 15, T1: 25, T2: 20, T3: 25, T4: 30 },
  VC: { S1: 25, S2: 40, S3: 35, O1: 20, O2: 20, O3: 20, O4: 20, O5: 20, T1: 20, T2: 20, T3: 35, T4: 25 },
};

export const PROFILE_NAMES: Record<Profile, string> = {
  OWNER: 'Inhaber oder Familie',
  CORPORATE: 'Konzern',
  PE: 'Private Equity',
  VC: 'Venture Capital',
};

/** Chapters and their question order (RO10). Questions not in scope are skipped. */
export const CHAPTERS: { title: string; ids: string[] }[] = [
  { title: 'Ziele, Entscheidung und Zukunftsplan', ids: ['Q01', 'Q02', 'Q44', 'Q05', 'Q06', 'Q50', 'Q03', 'Q04', 'Q54'] },
  { title: 'Wirtschaftlichkeit und Leistungsversprechen', ids: ['Q07', 'Q08', 'Q19', 'Q20'] },
  { title: 'Umsatz, Lieferkette und Betrieb', ids: ['Q09', 'Q10', 'Q11', 'Q15', 'Q16', 'Q17', 'Q18', 'Q47'] },
  { title: 'Personen und Kontinuität', ids: ['Q12', 'Q13', 'Q14', 'Q46'] },
  { title: 'Finanzen', ids: ['Q21', 'Q45', 'Q22', 'Q23', 'Q24', 'Q55'] },
  { title: 'Steuern', ids: ['Q25', 'Q26', 'Q28', 'Q29', 'Q31', 'Q49', 'Q52'] },
  { title: 'Recht', ids: ['Q32', 'Q33', 'Q53', 'Q34', 'Q35', 'Q36', 'Q37', 'Q38', 'Q39'] },
  { title: 'Transaktionsdurchführung', ids: ['Q41', 'Q48'] },
];

/** After this chapter (index) the interim result is shown (ER1). */
export const INTERIM_AFTER_CHAPTER = 3;

export const ROUTE_LABELS: Record<RouteCode, string> = {
  CORE: 'Kernfragen',
  RESTRUCTURING: 'Frühere Umstrukturierungen',
  DEBT: 'Kredite und Sicherheiten',
  ACQUISITIONS: 'Integration von Zukäufen',
  CONTINGENT: 'Earn-out oder Rückbeteiligung',
  REGULATED: 'Genehmigungen und Zulassungen',
  EMPLOYEE_EQUITY: 'Beteiligung von Mitarbeitenden',
  INVESTOR_RIGHTS: 'Investorenrechte',
  PE_CONTEXT: 'Wertsteigerung seit Einstieg',
  SEPARATION: 'Separierung',
  ASSET_TRANSFER: 'Übertragung von Vermögenswerten',
  CROSS_BORDER: 'Mehrere Länder',
  PARTIAL: 'Teilverkauf',
  PRIMARY_CAPITAL: 'Wachstumskapital',
};

/** Suggested lead per domain (ER11): default, family (not owner-led), owner-led. */
export const DOMAIN_LEAD: Record<DomainKey, { default: string; family: string; owner: string }> = {
  S1: { default: 'Gesellschafter / Transaktionsleitung', family: 'Gesellschafter', owner: 'Sie' },
  S2: { default: 'Gremien / Recht', family: 'Gesellschafter / Ihr Anwalt', owner: 'Sie oder Ihr Anwalt' },
  S3: { default: 'Strategie / Berater', family: 'Gesellschafter / Ihr M&A-Berater', owner: 'Sie oder Ihr M&A-Berater' },
  O1: { default: 'CFO', family: 'Geschäftsführung / Finanzen', owner: 'Sie' },
  O2: { default: 'Vertrieb / Operations', family: 'Vertrieb / Operations', owner: 'Sie' },
  O3: { default: 'Geschäftsführung / Personal / Separierungsleitung', family: 'Geschäftsführung / Personal', owner: 'Sie' },
  O4: { default: 'Operations / IT', family: 'Operations / IT', owner: 'Sie' },
  O5: { default: 'Vertrieb / Produkt', family: 'Vertrieb / Produkt', owner: 'Sie' },
  T1: { default: 'CFO / Berater', family: 'Geschäftsführung / Ihr Steuerberater', owner: 'Sie oder Ihr Steuerberater' },
  T2: { default: 'Steuerberater der Verkäufer und der Gesellschaft', family: 'Ihr Steuerberater', owner: 'Ihr Steuerberater' },
  T3: { default: 'Recht', family: 'Ihr Anwalt', owner: 'Sie oder Ihr Anwalt' },
  T4: { default: 'Transaktionsleitung', family: 'Sie / Ihr M&A-Berater', owner: 'Sie / Ihr M&A-Berater' },
};

const c = (d: string, owner: string, family: string | null = null): Contributors => ({ default: d, owner, family });
const t = (question: string, a0: string, a50: string, a100: string): QuestionText => ({ question, anchors: [a0, a50, a100] });

function q(
  id: string, domain: DomainKey, localWeight: 1 | 2 | 3, route: RouteCode, name: string, statusType: StatusType,
  contributors: Contributors, evidence: string, base: QuestionText, extra: Partial<QuestionDef> = {},
): QuestionDef {
  const chapter = CHAPTERS.findIndex((ch) => ch.ids.includes(id));
  if (chapter < 0) throw new Error(`${id} has no chapter`);
  return { id, domain, localWeight, route, name, chapter, statusType, contributors, evidence, base, ...extra };
}

export const QUESTIONS: QuestionDef[] = [
  // ── Kapitel 1: Ziele, Entscheidung und Zukunftsplan ───────────────────────
  q('Q01', 'S1', 2, 'CORE', 'Ziele des Verkaufs', 'G',
    c('Führender Gesellschafter / Finanzinvestor', 'Sie', 'Führender Gesellschafter'),
    'Datiertes Zielpapier mit Rangfolge der Ziele',
    t('Haben Sie festgelegt, was Ihnen beim Verkauf am wichtigsten ist, z. B. Preis, Mitarbeitende, Ihre Rolle oder der Zeitpunkt?',
      'Nein, noch nicht.', 'Die Ziele kennen wir, die Reihenfolge ist offen.', 'Ja, Ziele und Reihenfolge sind schriftlich festgehalten.')),
  q('Q02', 'S1', 1, 'CORE', 'Zeitplan und Vorbereitung', 'G',
    c('Transaktionsleitung', 'Sie', 'Sie / Ihr M&A-Berater'),
    'Datierter Zeitplan mit Vorbereitungsschritten, Reihenfolge und Verantwortlichen',
    t('Haben Sie einen Zeitplan, der zeigt, was bis zur Ansprache der Käufer noch zu erledigen ist?',
      'Nein, es gibt noch keinen Zeitplan.', 'Ein Zieltermin steht, die Schritte dahin sind nicht geplant.', 'Ja, Zieltermin und Schritte in sinnvoller Reihenfolge sind festgehalten.')),
  q('Q44', 'S1', 3, 'SEPARATION', 'Abgrenzung des Verkaufsumfangs', 'K',
    c('Konzern-M&A / Recht', 'Sie oder Ihr M&A-Berater', 'Geschäftsführung / Ihr Anwalt'),
    'Perimeterübersicht (Gesellschaften, Mitarbeitende, Vermögenswerte, Verträge, Verpflichtungen) zum Stichtag',
    t('Ist festgelegt, was genau zum verkauften Teil gehört, also Gesellschaften, Mitarbeitende, Verträge, Anlagen und Verpflichtungen?',
      'Nein, die Grenzen sind noch offen.', 'Ein Entwurf steht, einzelne Zuordnungen sind offen.', 'Ja, alles ist zugeordnet und festgehalten.')),
  q('Q05', 'S3', 2, 'CORE', 'Wege für den Verkauf', 'G',
    c('Transaktionsleitung / Berater', 'Sie oder Ihr M&A-Berater', 'Sie / Ihr M&A-Berater'),
    'Datierter Vergleich der Verkaufswege mit Vor- und Nachteilen, gemessen an den Zielen aus Q01',
    t('Haben Sie verglichen, welche Wege für einen Verkauf in Frage kommen, z. B. an ein anderes Unternehmen, einen Finanzinvestor, Ihr Management oder in der Familie?',
      'Nein, noch nicht verglichen.', 'Die Wege kennen wir, Vor- und Nachteile sind nicht abgewogen.', 'Ja, Vor- und Nachteile sind gegen unsere Ziele abgewogen und festgehalten.')),
  q('Q06', 'S3', 2, 'CORE', 'Künftige Rolle der Führung', 'F',
    c('Management / Eigentümer', 'Sie'),
    'Datierte Notiz zu Rolle, Dauer der Übergangszeit und, wo jemand ausscheidet, benanntem Nachfolger',
    t('Haben Sie festgelegt, welche Rolle Sie nach dem Verkauf übernehmen und wie lange?',
      'Nein, das ist noch offen.', 'Rolle und Dauer stehen, für ausscheidende Personen fehlt ein Nachfolger.', 'Ja, Rolle und Dauer stehen; wo jemand ausscheidet, ist ein Nachfolger benannt.')),
  q('Q50', 'S3', 2, 'PE_CONTEXT', 'Wertsteigerung seit Einstieg', 'N',
    c('Finanzinvestor / CFO', 'Finanzinvestor / CFO'),
    'Wertsteigerungsbrücke seit Einstieg (Ergebnisbeitrag je Maßnahme, Markteffekt getrennt)',
    t('Können Sie mit Zahlen zeigen, welche Verbesserungen seit dem Einstieg des Investors auf eigene Maßnahmen zurückgehen und nicht auf den Markt?',
      'Nein, das ist nicht belegt.', 'Die wichtigsten Maßnahmen sind belegt, eine Ergebnisüberleitung fehlt.', 'Ja, Maßnahmen und Ergebniswirkung sind übergeleitet, Grenzen sind benannt.')),
  q('Q03', 'S2', 3, 'CORE', 'Einigkeit der Entscheider', 'G',
    c('Führender Gesellschafter / Gremien', 'Sie', 'Führender Gesellschafter'),
    'Gesellschafterbeschluss oder gemeinsames Zielpapier der Gesellschafter',
    t('Sind sich alle, die über den Verkauf mitentscheiden, über die Ziele einig?',
      'Nein, es gibt grundlegende Meinungsunterschiede.', 'Weitgehend, einzelne wichtige Punkte sind offen.', 'Ja, gemeinsam beschlossen, oder ich entscheide allein.')),
  q('Q04', 'S2', 2, 'CORE', 'Zustimmungen zum Verkauf', 'G',
    c('Recht / Gremienbüro', 'Sie oder Ihr Anwalt', 'Recht / Ihr Anwalt'),
    'Übersicht erforderlicher Zustimmungen (Gesellschaftsvertrag, Beirat, ggf. Ehepartner) mit Zeitplan',
    t('Haben Sie geklärt, wer einem Verkauf zustimmen muss (z. B. Mitgesellschafter, Beirat, Ehepartner)?',
      'Nein, das haben wir nicht geklärt.', 'Die Beteiligten kennen wir, Ablauf und Zeitpunkt sind offen.', 'Ja, Zustimmungen, Ablauf und Zeitplan sind festgehalten.')),
  q('Q54', 'S2', 3, 'PARTIAL', 'Mitsprache des neuen Investors', 'G',
    c('Gesellschafter / Recht', 'Sie oder Ihr Anwalt', 'Gesellschafter / Ihr Anwalt'),
    'Eckpunktepapier zur künftigen Governance (Beirat, Zustimmungsvorbehalte, Mitverkaufsrechte, Exit-Regeln)',
    t('Ist unter den Gesellschaftern abgestimmt, welche Mitsprache ein neuer Investor nach dem Teilverkauf bekommen soll, z. B. Beirat oder Zustimmungsrechte?',
      'Nein, darüber haben wir nicht gesprochen.', 'Erste Vorstellungen gibt es, wichtige Punkte sind offen.', 'Ja, unsere Vorstellungen und Grenzen für die Verhandlung sind festgehalten.')),

  // ── Kapitel 2: Wirtschaftlichkeit und Leistungsversprechen ────────────────
  q('Q07', 'O1', 3, 'CORE', 'Dauerhafter Gewinn', 'F',
    c('CFO', 'Sie'),
    'Datiertes Dokument mit verantwortlicher Person, das den bereinigten, dauerhaften Gewinn herleitet',
    t('Können Sie erklären, welchen Gewinn Ihr Unternehmen dauerhaft erwirtschaftet, also ohne einmalige Erträge oder Kosten?',
      'Nein, das haben wir noch nicht hergeleitet.', 'Die Treiber kennen wir, eine saubere Herleitung fehlt.', 'Ja, hergeleitet und mit bereinigten Zahlen belegt.')),
  q('Q08', 'O1', 2, 'CORE', 'Liquiditätsplanung', 'F',
    c('CFO', 'Sie'),
    'Datierte Liquiditätsplanung über 12 Monate mit Szenarien und verantwortlicher Person',
    t('Haben Sie eine Liquiditätsplanung für die nächsten 12 Monate?',
      'Nein, keine laufende Planung.', 'Ja, aber ohne Szenarien und Gegenmaßnahmen.', 'Ja, laufend gepflegt, mit Szenarien und finanzierten Gegenmaßnahmen.')),
  q('Q19', 'O5', 2, 'CORE', 'Belegbare Kundenvorteile', 'F',
    c('Vertriebs- / Produktleitung', 'Sie'),
    'Datierte Sammlung von Kundennachweisen (Befragung, Referenzen, Wiederkaufquote)',
    t('Können Sie belegen, warum sich Kunden für Ihr Produkt oder Ihre Leistung entscheiden?',
      'Nein, das beruht auf unserer Einschätzung.', 'Teilweise, zum Beispiel einzelne Referenzen oder Kundenstimmen.', 'Ja, zum Beispiel mit Kundenbefragungen, Referenzen oder Zahlen zu Wiederkauf und Preisen.')),
  q('Q20', 'O5', 2, 'CORE', 'Weiterentwicklung des Angebots', 'K',
    c('Produkt / Strategie', 'Sie'),
    'Datierte Planung mit Prioritäten, Ressourcen, Meilensteinen und verantwortlicher Person',
    t('Wissen Sie, wie Sie Ihr Angebot als Nächstes weiterentwickeln?',
      'Nein, Prioritäten sind nicht festgelegt.', 'Die Prioritäten stehen, ein Umsetzungsplan fehlt.', 'Ja, mit Budget, Personal, Meilensteinen und Erfolgskennzahlen.')),

  // ── Kapitel 3: Umsatz, Lieferkette und Betrieb ────────────────────────────
  q('Q09', 'O2', 3, 'CORE', 'Wegfall eines großen Kunden', 'K',
    c('Vertriebsleitung / CFO', 'Sie'),
    'Kundenliste mit Umsatzanteilen und Gegenmaßnahmen',
    t('Wissen Sie, was Sie tun würden, wenn ein großer Kunde wegfällt?',
      'Nein, darüber haben wir noch nicht nachgedacht.', 'Die Auswirkung kennen wir, ein Plan fehlt noch.', 'Ja, Gegenmaßnahmen sind festgehalten, oder kein Kunde bringt über 10 % Umsatz.')),
  q('Q10', 'O2', 2, 'CORE', 'Kundenbindung', 'F',
    c('Vertriebsleitung', 'Sie'),
    'Auswertung Kundenbindung über 3 Jahre plus Vertragsübersicht',
    t('Können Sie mit Zahlen zeigen, dass Ihre Kunden bleiben und wieder kaufen?',
      'Nein, das werten wir nicht aus.', 'Teilweise, die Zahlen sind lückenhaft.', 'Ja, mit Zahlen über mehrere Jahre, z. B. Wiederkaufquote oder Vertragslaufzeiten.')),
  q('Q11', 'O2', 1, 'CORE', 'Ausfall eines Lieferanten', 'F',
    c('Operations', 'Sie'),
    'Liste kritischer Lieferanten und Dienstleister mit Ausweichlösung',
    t('Könnten Sie Ihre Leistung weiter erbringen, wenn ein wichtiger Lieferant oder Dienstleister ausfällt, z. B. ein Zulieferer oder Cloud-Anbieter?',
      'Nein, dafür gibt es keine Vorsorge.', 'Alternativen sind bekannt, aber nicht vorbereitet.', 'Ja, Ausweichlösungen sind vorbereitet, oder wir hängen von keinem einzelnen Anbieter ab.')),
  q('Q15', 'O4', 2, 'CORE', 'Beschriebene Abläufe', 'F',
    c('Operations', 'Sie'),
    'Prozessbeschreibungen mit Verantwortlichen',
    t('Könnte eine neue Person die wichtigsten Abläufe anhand Ihrer Unterlagen erledigen?',
      'Nein, das Wissen steckt in den Köpfen.', 'Teilweise, einige Abläufe sind beschrieben.', 'Ja, beschrieben und mit festen Verantwortlichen.')),
  q('Q16', 'O4', 2, 'CORE', 'Engpässe bei mehr Nachfrage', 'K',
    c('Operations / CFO', 'Sie'),
    'Engpassanalyse mit Maßnahmen und Ressourcen',
    t('Wissen Sie, was Sie bei deutlich mehr Nachfrage bremsen würde und wie Sie das lösen?',
      'Nein, das haben wir nicht geprüft.', 'Die Engpässe kennen wir, Lösungen fehlen noch.', 'Ja, Engpässe und Lösungen mit Ressourcen sind festgehalten.')),
  q('Q17', 'O4', 2, 'CORE', 'Wiederherstellung der IT', 'K',
    c('IT / Informationssicherheit', 'IT-Verantwortliche, intern oder Dienstleister'),
    'Notfallplan mit Datum des letzten Tests',
    t('Könnten Sie Ihre wichtigen IT-Systeme nach einem längeren Ausfall wiederherstellen?',
      'Nein, dafür gibt es keine Vorkehrungen.', 'Vorkehrungen gibt es, aber mit Lücken oder ohne Tests.', 'Ja, festgehalten und regelmäßig getestet.')),
  q('Q18', 'O4', 2, 'ACQUISITIONS', 'Offene Punkte aus Zukäufen', 'F',
    c('Integrationsleitung', 'Sie', 'Geschäftsführung'),
    'Integrationsplan je Zukauf mit offenen Punkten, Verantwortlichen, Terminen und laufenden Earn-outs',
    t('Haben Sie einen Plan für offene Punkte aus früheren Zukäufen, z. B. für die Integration oder ausstehende Kaufpreiszahlungen (Earn-outs)?',
      'Nein, für offene Punkte gibt es keinen Plan.', 'Einen Plan gibt es, Verantwortliche oder Termine fehlen.', 'Ja, jeder Punkt hat Verantwortliche und Termine, der Stand wird verfolgt.')),
  q('Q47', 'O4', 3, 'SEPARATION', 'Trennung der IT-Systeme', 'K',
    c('IT / Recht', 'IT-Verantwortliche, intern oder Dienstleister', 'IT / Ihr Anwalt'),
    'IT-Trennungsplan mit Lizenzrechten, Datentrennung, Ablauf und Übergangsbetrieb',
    t('Ist geklärt, wie der verkaufte Teil seine IT-Systeme und Daten nach dem Verkauf nutzen oder abtrennen kann?',
      'Nein, das ist nicht geplant.', 'Ein Plan steht, mit Lücken, z. B. bei Lizenzen oder Daten.', 'Ja, Rechte, Ablauf und Übergangsbetrieb stehen fest, oder die Systeme sind schon getrennt.')),

  // ── Kapitel 4: Personen und Kontinuität ───────────────────────────────────
  q('Q12', 'O3', 3, 'CORE', 'Vertretung bei Entscheidungen', 'F',
    c('Geschäftsführung', 'Sie'),
    'Vertretungsregelung mit Vollmachten (z. B. Prokura, Freigabegrenzen)',
    t('Was würde ins Stocken geraten, wenn Sie vier Wochen nicht da wären?',
      'Vieles, auch Alltagsentscheidungen müssten warten.', 'Das Tagesgeschäft läuft, einzelne wichtige Entscheidungen müssten warten.', 'Nichts Wesentliches; Vertretung und Befugnisse sind schriftlich geregelt.')),
  q('Q13', 'O3', 2, 'CORE', 'Vertretung für Fachwissen', 'F',
    c('Operations / Personalleitung', 'Sie'),
    'Vertretungsplan für Schlüsselpersonen mit Stand der Einarbeitung',
    t('Könnte jemand anderes die Arbeit Ihrer wichtigsten Fachleute übernehmen, wenn diese länger ausfallen?',
      'Nein, dafür gibt es niemanden.', 'Eine Vertretung ist benannt, aber nicht eingearbeitet.', 'Ja, die Vertretung ist eingearbeitet und das Wissen übergeben.')),
  q('Q14', 'O3', 2, 'CORE', 'Ansprechpartner der Schlüsselkunden', 'F',
    c('Vertriebsleitung', 'Sie'),
    'Übersicht Schlüsselkunden mit Zuständigen und Vertretung',
    t('Haben Ihre wichtigsten Kunden mehr als einen festen Ansprechpartner bei Ihnen?',
      'Nein, alles läuft über eine Person.', 'Weitere Kontakte gibt es, die Zuständigkeit ist aber nicht geregelt.', 'Ja, jeder hat feste Zuständige und eine Vertretung.')),
  q('Q46', 'O3', 3, 'SEPARATION', 'Gemeinsam genutzte Leistungen', 'K',
    c('Separierungsleitung', 'Sie', 'Geschäftsführung'),
    'Liste gemeinsam genutzter Leistungen mit Lösung (Übernahme, Übergangsvereinbarung, Neuaufbau) und Verantwortlichen',
    t('Ist geklärt, wie Leistungen, die heute vom Konzern oder vom übrigen Unternehmen kommen (z. B. IT, Buchhaltung, Einkauf), nach dem Verkauf weiterlaufen?',
      'Nein, dafür gibt es noch keine Lösung.', 'Die Leistungen sind erfasst, einzelne Lösungen fehlen.', 'Ja, jede Leistung hat eine Lösung, oder es gibt keine.')),

  // ── Kapitel 5: Finanzen ───────────────────────────────────────────────────
  q('Q21', 'T1', 3, 'CORE', 'Zahlen der letzten drei Jahre', 'K',
    c('CFO', 'Sie oder Ihr Steuerberater'),
    'Finanzpaket 3 Jahre (Abschlüsse, Monatszahlen, Überleitung der Bereinigungen) mit verantwortlicher Person',
    t('Könnten Sie einem Käufer Ihre Zahlen der letzten drei Jahre so vorlegen, dass alles zusammenpasst?',
      'Nein, Unterlagen fehlen oder passen nicht zusammen.',
      'Abschlüsse und Monatszahlen liegen vor, die Bereinigung um Einmaliges fehlt.',
      'Ja, Monatszahlen, Abschlüsse und die Bereinigung um einmalige Erträge und Kosten passen zusammen.')),
  q('Q45', 'T1', 3, 'SEPARATION', 'Eigene Zahlen des verkauften Teils', 'K',
    c('CFO / Carve-out-Finanzteam', 'Sie oder Ihr Steuerberater', 'CFO / Ihr Steuerberater'),
    'Carve-out-Zahlen für 3 Jahre mit Schlüsseln für gemeinsame Kosten und Stand-alone-Anpassungen',
    t('Können Sie die Zahlen des verkauften Teils so zeigen, als wäre er schon eigenständig?',
      'Nein, eigene Zahlen für den Teil gibt es nicht.', 'Zahlen gibt es, die Aufteilung gemeinsamer Kosten ist offen.', 'Ja, eigene Zahlen mit erklärter Kostenaufteilung liegen vor.')),
  q('Q22', 'T1', 2, 'CORE', 'Planung mit erklärten Annahmen', 'F',
    c('CFO', 'Sie'),
    'Mehrjahresplanung mit dokumentierten Annahmen (Kunden, Preise, Personal)',
    t('Haben Sie eine Planung für die nächsten Jahre, deren Annahmen Sie erklären können?',
      'Nein, es gibt keine Planung.', 'Es gibt eine Planung, die Annahmen sind nicht festgehalten.', 'Ja, jede Planzahl beruht auf einer festgehaltenen Annahme.')),
  q('Q23', 'T1', 2, 'CORE', 'Abzüge und Zuschläge zum Kaufpreis', 'N',
    c('CFO / Transaktionsberater', 'Sie oder Ihr M&A-Berater'),
    'Aufstellung Finanzschulden, schuldenähnliche Posten (inkl. offene Kaufpreiszahlungen, Auszahlungen aus Beteiligungen) und Barmittel zum Stichtag',
    t('Wissen Sie, welche Schulden, Pensionszusagen und Bankguthaben beim Verkauf vom Kaufpreis abgezogen oder hinzugerechnet werden?',
      'Nein, damit haben wir uns noch nicht befasst.', 'Die großen Posten kennen wir, eine vollständige Aufstellung fehlt.', 'Ja, alle Posten sind mit aktuellen Beträgen aufgestellt.')),
  q('Q24', 'T1', 3, 'DEBT', 'Zustimmung der Banken', 'N',
    c('CFO / Recht', 'Sie', 'CFO / Ihr Anwalt'),
    'Übersicht Kreditverträge mit Kontrollwechselklauseln, Sicherheiten und Zeitplan',
    t('Wissen Sie, ob Ihre Banken einem Verkauf zustimmen müssen und wie Sicherheiten freigegeben werden, z. B. Ihre persönlichen Bürgschaften oder Grundschulden?',
      'Nein, das haben wir nicht geprüft.', 'Das wissen wir, das Vorgehen ist aber nicht geplant.', 'Ja, geprüft; nötige Zustimmungen und Zeitplan sind festgehalten.')),
  q('Q55', 'T1', 2, 'PRIMARY_CAPITAL', 'Mittelverwendung und Verkaufserlöse', 'G',
    c('CFO / Gesellschafter', 'Sie'),
    'Mittelverwendungsplan für das neue Kapital, verknüpft mit der Planung aus Q22, plus Aufstellung etwaiger Verkaufserlöse',
    t('Ist klar getrennt, wie viel Geld ins Unternehmen fließt und wie viel an Gesellschafter, die Anteile verkaufen?',
      'Nein, das ist nicht getrennt.', 'Eine grobe Aufteilung gibt es, ein Finanzierungsplan fehlt.', 'Ja, Mittelverwendung und Verkaufserlöse sind getrennt geplant, oder alles fließt ins Unternehmen.')),

  // ── Kapitel 6: Steuern ────────────────────────────────────────────────────
  q('Q25', 'T2', 3, 'CORE', 'Steuerliche Vorbereitung und Optimierung', 'G',
    c('Verkäufer / steuerliche Leitung', 'Sie oder Ihr Steuerberater', 'Sie / Ihr Steuerberater'),
    'Datierter steuerlicher Vergleich der Verkaufsformen mit Annahmen und Auftrag des Steuerberaters',
    t('Hat ein Steuerberater geprüft, wie Sie den Verkauf steuerlich am besten gestalten (z. B. Anteile direkt, über eine Holding, nur der Geschäftsbetrieb)?',
      'Nein, noch nicht.', 'Wir haben es allgemein besprochen, ein Vergleich fehlt.', 'Ja, ein Steuerberater mit Erfahrung bei Unternehmensverkäufen hat die Verkaufsformen verglichen und schriftlich festgehalten.')),
  q('Q26', 'T2', 3, 'CORE', 'Wer verkauft und wo steuerpflichtig', 'G',
    c('Steuerberater', 'Ihr Steuerberater', 'Ihr Steuerberater'),
    'Gesellschafterübersicht mit Rechtsform, Anteilen und Steuersitz',
    t('Ist festgehalten, wer genau verkauft und wo die Verkäufer steuerpflichtig sind?',
      'Nein, das ist nicht zusammengestellt.', 'Grob ja, Beteiligungen oder Holdings sind nicht vollständig erfasst.', 'Ja, alle Verkäufer mit Rechtsform, Anteil und Steuersitz sind erfasst.')),
  q('Q28', 'T2', 3, 'RESTRUCTURING', 'Sperrfristen aus Umstrukturierungen', 'K',
    c('Steuerberater', 'Ihr Steuerberater', 'Ihr Steuerberater'),
    'Prüfvermerk des Steuerberaters zu früheren Umstrukturierungen und Fristen',
    t('Hat Ihr Steuerberater geprüft, ob frühere Umstrukturierungen einen Verkauf steuerlich einschränken (z. B. Sperrfristen)?',
      'Nein, das wurde nicht geprüft.', 'Die Unterlagen sind gesammelt, eine Beurteilung fehlt noch.', 'Ja, geprüft; Fristen oder Einschränkungen sind festgehalten.'),
    { naAllowed: true }),
  q('Q29', 'T2', 2, 'CORE', 'Offene Steuerthemen', 'K',
    c('Steuerberater / CFO', 'Sie oder Ihr Steuerberater'),
    'Liste steuerlicher Themen seit der letzten Betriebsprüfung mit Bewertung und Verantwortlichen',
    t('Haben Sie prüfen lassen, ob es offene Steuerthemen gibt, die ein Käufer finden könnte?',
      'Nein, das haben wir nicht geprüft.', 'Teilweise, z. B. bei der letzten Betriebsprüfung; seither nicht systematisch.', 'Ja, geprüft; Themen sind bewertet und zugeordnet, oder es gibt keine.')),
  q('Q31', 'T2', 3, 'CONTINGENT', 'Steuern auf Earn-out oder Rückbeteiligung', 'G',
    c('Steuerberater der Verkäufer', 'Ihr Steuerberater'),
    'Steuerliche Stellungnahme zu Earn-out, Rückbeteiligung bzw. aufgeschobener Zahlung',
    t('Hat Ihr Steuerberater geprüft, wie ein erfolgsabhängiger oder später gezahlter Kaufpreisteil oder eine Rückbeteiligung besteuert würde?',
      'Nein, das wurde nicht geprüft.', 'Grundsätzlich besprochen, die steuerliche Behandlung ist nicht festgehalten.', 'Ja, Behandlung und Annahmen sind festgehalten.'),
    { naAllowed: true }),
  q('Q49', 'T2', 3, 'SEPARATION', 'Steuerfolgen der Herauslösung', 'K',
    c('Steuerberater / Konzernsteuerabteilung', 'Ihr Steuerberater', 'Ihr Steuerberater'),
    'Steuerliche Stellungnahme zur Separierung (Organschaft, interne Salden, Verrechnungspreise, Umstrukturierungsschritte)',
    t('Hat ein Steuerberater geprüft, welche Steuerfolgen das Herauslösen des verkauften Teils hat, z. B. Ende einer Organschaft oder interne Verrechnungen?',
      'Nein, das wurde nicht geprüft.', 'Eine erste Prüfung gibt es, wichtige Punkte sind offen.', 'Ja, Steuerfolgen und Abhängigkeiten sind festgehalten.')),
  q('Q52', 'T2', 3, 'CROSS_BORDER', 'Steuerberater in allen Ländern', 'K',
    c('Federführender Steuerberater', 'Ihr Steuerberater'),
    'Übersicht der Länder mit zuständigen Beratern, Federführung und Arbeitsplan',
    t('Gibt es für alle betroffenen Länder einen Steuerberater, und stimmt sich einer federführend mit allen ab?',
      'Nein, nicht alle Länder sind abgedeckt.', 'Berater sind benannt, Aufgaben oder Abstimmung sind offen.', 'Ja, Länder, Berater, Federführung und Zeitplan sind festgehalten.')),

  // ── Kapitel 7: Recht ──────────────────────────────────────────────────────
  q('Q32', 'T3', 3, 'CORE', 'Nachweis der Anteile', 'N',
    c('Recht', 'Sie oder Ihr Anwalt', 'Recht / Ihr Anwalt oder Notar'),
    'Aktuelle Gesellschafterliste, Gesellschaftsvertrag und Nachweise aller Anteilsübertragungen',
    t('Können Sie lückenlos belegen, wem die Anteile an Ihrem Unternehmen gehören?',
      'Nein, es gibt Lücken in den Unterlagen.', 'Weitgehend, einzelne Punkte sind offen.', 'Ja, Gesellschafterliste und alle Übertragungen, z. B. Erbe oder Schenkung, sind belegt.')),
  q('Q33', 'T3', 3, 'CORE', 'Rechte an Software, Marken und Inhalten', 'K',
    c('Recht / Technologieleitung', 'Sie oder Ihr Anwalt', 'Technologieleitung / Ihr Anwalt'),
    'Übersicht wesentlicher Rechte (Software, Marken) mit Verträgen zur Rechteübertragung und Lizenzen',
    t('Können Sie belegen, dass Ihrem Unternehmen die Rechte an Software, Marken und Inhalten gehören, die es selbst entwickelt hat oder entwickeln ließ?',
      'Nein, das ist nicht geregelt.', 'Größtenteils; bei Freelancern oder Lizenzen ist manches unklar.', 'Ja, alles schriftlich belegt, oder wir nutzen nur Standardlizenzen.')),
  q('Q53', 'T3', 3, 'ASSET_TRANSFER', 'Übertragung von Verträgen und Anlagen', 'K',
    c('Recht', 'Sie oder Ihr Anwalt', 'Recht / Ihr Anwalt'),
    'Übertragungsliste (Verträge mit Zustimmungserfordernis, Übergang der Mitarbeitenden, Schutzrechte, Genehmigungen)',
    t('Haben Sie erfasst, was für die Übertragung von Verträgen, Mitarbeitenden und Anlagen nötig ist, z. B. Zustimmungen von Vertragspartnern?',
      'Nein, das haben wir nicht geprüft.', 'Die Anforderungen sind erfasst, wichtige Punkte sind offen.', 'Ja, alle Übertragungen und Schritte mit Dritten sind festgehalten.'),
    { naAllowed: true }),
  q('Q34', 'T3', 2, 'CORE', 'Wichtige Verträge beim Verkauf', 'K',
    c('Recht / Vertrieb', 'Sie oder Ihr Anwalt', 'Vertrieb / Ihr Anwalt'),
    'Übersicht wesentlicher Verträge (Kunden, Lieferanten, Miete, Lizenzen) mit Kontrollwechselklauseln und Zustimmungen',
    t('Haben Sie geprüft, ob wichtige Verträge, z. B. mit großen Kunden, Lieferanten oder dem Vermieter, bei einem Verkauf gekündigt werden können oder eine Zustimmung brauchen?',
      'Nein, das haben wir nicht geprüft.', 'Die wichtigsten Verträge sind geprüft, Folgeschritte sind offen.', 'Ja, geprüft; nötige Zustimmungen und Schritte sind festgehalten.')),
  q('Q35', 'T3', 2, 'CORE', 'Streitigkeiten', 'K',
    c('Recht', 'Sie oder Ihr Anwalt', 'Recht / Ihr Anwalt'),
    'Liste laufender und drohender Streitigkeiten mit Einschätzung bzw. Erklärung, dass keine bestehen',
    t('Haben Sie einen vollständigen Überblick über laufende oder drohende Streitigkeiten, z. B. mit Kunden, Mitarbeitenden oder Behörden?',
      'Nein, dazu gibt es keinen Überblick.', 'Bekannte Fälle sind erfasst, aber nicht bewertet.', 'Ja, es gibt keine, oder alle sind bewertet und finanziell berücksichtigt.')),
  q('Q36', 'T3', 2, 'CORE', 'Datenschutz', 'K',
    c('Datenschutz / Recht', 'Ihr Datenschutzbeauftragter', 'Datenschutz / Ihr Anwalt'),
    'Bericht des Datenschutzbeauftragten mit Maßnahmenliste und Verantwortlichen',
    t('Hat jemand, z. B. Ihr Datenschutzbeauftragter, geprüft, ob Ihr Unternehmen die Datenschutzregeln einhält?',
      'Nein, das hat niemand geprüft.', 'Ja, aber offene Punkte sind noch nicht behoben.', 'Ja, geprüft; offene Punkte sind behoben oder haben Verantwortliche und Termine.')),
  q('Q37', 'T3', 3, 'REGULATED', 'Genehmigungen nach dem Verkauf', 'K',
    c('Regulatorik / Recht', 'Sie oder Ihr Anwalt', 'Regulatorik / Ihr Anwalt'),
    'Liste der Genehmigungen mit Folgen eines Eigentümerwechsels, nötigen Anträgen oder Anzeigen und Zeitplan',
    t('Haben Sie geprüft, ob Ihre Genehmigungen und Zulassungen nach einem Verkauf weiter gelten?',
      'Nein, das haben wir nicht geprüft.', 'Die Anforderungen kennen wir, die Schritte sind nicht geplant.', 'Ja, geprüft; nötige Anträge, Anzeigen und Zeitplan sind festgehalten.')),
  q('Q38', 'T3', 3, 'INVESTOR_RIGHTS', 'Erlösverteilung unter den Gesellschaftern', 'K',
    c('Recht / CFO', 'Recht / CFO'),
    'Erlösverteilungsrechnung für mehrere Preisszenarien einschließlich Wandlung, auf Basis der Gesellschaftervereinbarung und der Wandelverträge',
    t('Können Sie zeigen, wie der Verkaufserlös bei verschiedenen Preisen unter den Gesellschaftern verteilt wird, einschließlich Vorzugsrechten und Wandeldarlehen?',
      'Nein, Vorzugs- und Wandelrechte sind nicht zusammengestellt.', 'Die Rechte sind erfasst, eine Berechnung je Preis fehlt.', 'Ja, für mehrere Preise durchgerechnet, oder es gibt keine Vorzugs- oder Wandelrechte.')),
  q('Q39', 'T3', 2, 'EMPLOYEE_EQUITY', 'Beteiligungen von Mitarbeitenden', 'G',
    c('Recht / Personal / Steuern', 'Sie oder Ihr Anwalt', 'Sie / Ihr Anwalt'),
    'Übersicht der Vereinbarungen mit Berechtigten, Bedingungen, Behandlung beim Verkauf und Kosten',
    t('Ist geregelt, was bei einem Verkauf mit den Beteiligungen von Mitarbeitenden und Management passiert (z. B. Anteile, Optionen oder eine virtuelle Beteiligung)?',
      'Nein, das ist nicht geregelt.', 'Die Vereinbarungen sind erfasst, die Behandlung beim Verkauf ist offen.', 'Ja, für jede Vereinbarung ist festgehalten, was beim Verkauf passiert.')),

  // ── Kapitel 8: Transaktionsdurchführung ──────────────────────────────────
  q('Q41', 'T4', 2, 'CORE', 'Team für den Verkauf', '-',
    c('Transaktionsleitung', 'Sie', 'Sie'),
    'Projektplan mit Team, Berater, Rollen und Zeitplan',
    t('Haben Sie schon ein Team für den Verkauf, z. B. mit einem M&A-Berater?',
      'Nein, noch nicht.', 'Teilweise; ein internes Team oder ein erfahrener Berater fehlt noch.', 'Ja, Team und Berater stehen, Rollen und Zeitplan sind vereinbart.')),
  q('Q48', 'T4', 3, 'SEPARATION', 'Übergangsvereinbarungen', 'K',
    c('Separierungsleitung / Recht', 'Sie oder Ihr Anwalt', 'Geschäftsführung / Ihr Anwalt'),
    'Entwürfe der Übergangsvereinbarungen mit Leistungsverzeichnis, Preisen, Laufzeit und Ausstiegsplan',
    t('Sind Übergangsvereinbarungen vorbereitet, mit denen der Konzern oder das übrige Unternehmen Leistungen noch eine Zeit lang erbringt?',
      'Nein, solche Vereinbarungen sind nicht geplant.', 'Teilweise; Leistungen, Preise oder Laufzeiten sind offen.', 'Ja, Leistungen, Preise, Laufzeiten und Ausstiegspläne sind vorbereitet.'),
    { naAllowed: true }),
];

export const QUESTION_BY_ID: Record<string, QuestionDef> = Object.fromEntries(QUESTIONS.map((x) => [x.id, x]));

export function dimensionOf(domain: DomainKey): DimensionKey {
  return domain[0] as DimensionKey;
}

/** Task dependencies (ER12): a task for the key waits for the listed questions. Q31 waits for Q25; Q22/Q23 wait for Q45 when only part is sold. */
export const DEPENDENCIES: Record<string, string[]> = {
  Q05: ['Q01'],
  Q22: ['Q21'],
  Q23: ['Q21'],
  Q24: ['Q23'],
  Q31: ['Q25'],
  Q38: ['Q32'],
  Q45: ['Q44'],
  Q48: ['Q46', 'Q47'],
  Q49: ['Q44'],
  Q52: ['Q26'],
};

// Fail fast if a chapter lists an unknown question.
for (const ch of CHAPTERS) for (const id of ch.ids) if (!QUESTION_BY_ID[id]) throw new Error(`Unknown question ${id} in chapter ${ch.title}`);
