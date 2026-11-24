// Option lists for the context page (K1–K4) and the setup (EI4–EI10).
// Values are stable ids that get persisted; labels are presentation only.

import type {
  Country, Earnings, Horizon, Intent, LargestCustomer, Liquidity, ManagementModel, OwnershipTag, RecurringShare, Seller, SellerTax, Topic,
} from './types';

export type Opt<T extends string> = { value: T; label: string; sub?: string };

/** K1 (KO2) */
export const OWNERSHIP_OPTIONS: Opt<OwnershipTag>[] = [
  { value: 'private_family', label: 'Privat oder Familie' },
  { value: 'corporate_group', label: 'Konzern' },
  { value: 'pe', label: 'Private Equity' },
  { value: 'vc', label: 'Venture Capital' },
  { value: 'other', label: 'Sonstiges' },
];

/** K2 (KO3) */
export const MANAGEMENT_OPTIONS: Opt<ManagementModel>[] = [
  { value: 'owner_led', label: 'Inhabergeführt' },
  { value: 'employed', label: 'Angestelltes Management' },
  { value: 'mixed', label: 'Gemischt' },
];

/** K3 (KO5). Option 1 has a Konzern wording, see intentLabel. */
export const INTENT_OPTIONS: Opt<Intent>[] = [
  { value: 'whole', label: 'Das ganze Unternehmen verkaufen (z. B. als Nachfolgelösung)' },
  { value: 'part', label: 'Einen Teil des Unternehmens verkaufen (Geschäftsbereich oder Standort)' },
  { value: 'shares', label: 'Anteile teilweise verkaufen (Teilverkauf)' },
  { value: 'investor', label: 'Einen Investor aufnehmen, um Wachstum zu finanzieren' },
  { value: 'open', label: 'Noch offen, wir prüfen die Möglichkeiten' },
  { value: 'crisis', label: 'Krise oder Sanierung' },
];

/** K4 (KO6) */
export const LIQUIDITY_OPTIONS: Opt<Liquidity>[] = [
  { value: 'no_pressure', label: 'Ja' },
  { value: 'potential', label: 'Wahrscheinlich, das sollten wir aber prüfen' },
  { value: 'acute', label: 'Nein, es gibt akute Zahlungsschwierigkeiten' },
];

/** EI4: options unchanged, without explanation. */
export const HORIZON_OPTIONS: Opt<Horizon>[] = [
  { value: 'under_6', label: 'In weniger als 6 Monaten' },
  { value: 'm6_18', label: 'In 6 bis 18 Monaten' },
  { value: 'm19_36', label: 'In 19 bis 36 Monaten' },
  { value: 'over_36', label: 'In mehr als 36 Monaten' },
  { value: 'undecided', label: 'Noch nicht entschieden' },
];

/** EI9: specialist topics with their sub-line, in the order of the change list. */
export const TOPIC_OPTIONS: Opt<Topic>[] = [
  { value: 'debt', label: 'Kredite, Gesellschafterdarlehen oder Sicherheiten', sub: 'z. B. Bankkredit, Darlehen eines Gesellschafters, Bürgschaft oder Grundschuld' },
  { value: 'acquisitions', label: 'Ein früherer Zukauf mit laufender Integration', sub: 'Sie haben ein Unternehmen gekauft, und die Eingliederung oder eine Kaufpreiszahlung läuft noch' },
  { value: 'employee_equity', label: 'Beteiligung von Mitarbeitenden oder Management', sub: 'Mitarbeitende oder Geschäftsführer haben Anteile, Optionen oder eine virtuelle Beteiligung' },
  { value: 'regulated', label: 'Genehmigungen oder Zulassungen', sub: 'Erlaubnisse, ohne die Sie nicht arbeiten dürfen, z. B. Gewerbeerlaubnis oder Zulassung' },
  { value: 'contingent', label: 'Earn-out oder Rückbeteiligung im Gespräch', sub: 'Ein Teil des Kaufpreises soll später oder erfolgsabhängig fließen, oder Sie bleiben beteiligt' },
  { value: 'shared_services', label: 'Wir nutzen Leistungen einer anderen Firma des Eigentümers, die nicht mitverkauft wird', sub: 'z. B. IT, Buchhaltung, Büroräume' },
  { value: 'restructuring', label: 'Frühere Umstrukturierungen', sub: 'z. B. Holding gegründet oder Anteile in eine andere Firma eingebracht, in den letzten sieben Jahren' },
  { value: 'cross_border_ops', label: 'Tätigkeit in mehreren Ländern', sub: 'Standorte, Tochterfirmen oder Mitarbeitende im Ausland' },
];

/** Short names of the topics (status line "vorläufig · [Thema] noch ungeklärt", notices). */
export const TOPIC_SHORT: Record<Topic, string> = {
  debt: 'Kredite und Sicherheiten',
  acquisitions: 'Früherer Zukauf',
  employee_equity: 'Beteiligung von Mitarbeitenden',
  regulated: 'Genehmigungen',
  contingent: 'Earn-out oder Rückbeteiligung',
  shared_services: 'Leistungen einer anderen Firma des Eigentümers',
  restructuring: 'Frühere Umstrukturierungen',
  cross_border_ops: 'Tätigkeit in mehreren Ländern',
};

/** EI10. The holding wording changes for families (see sellerLabel). */
export const SELLER_OPTIONS: Opt<Seller>[] = [
  { value: 'individuals_domestic', label: 'Privatpersonen, alle im Inland steuerpflichtig' },
  { value: 'individuals_foreign', label: 'Privatpersonen, mindestens eine im Ausland steuerpflichtig' },
  { value: 'holding', label: 'Holdinggesellschaften oder eine Konzernmutter' },
  { value: 'funds', label: 'Investmentfonds' },
  { value: 'mixed', label: 'Gemischt' },
  { value: 'unknown', label: 'Noch unklar' },
];

export const SELLER_TAX_OPTIONS: Opt<SellerTax>[] = [
  { value: 'same', label: 'Alle im Inland' },
  { value: 'different', label: 'In einem anderen Land' },
  { value: 'multiple', label: 'Verteilt auf mehrere Länder' },
  { value: 'unknown', label: 'Nicht sicher' },
];

export const COUNTRY_OPTIONS: Opt<Country>[] = [
  { value: 'DE', label: 'Deutschland' },
  { value: 'AT', label: 'Österreich' },
  { value: 'CH', label: 'Schweiz' },
  { value: 'other', label: 'Anderes Land' },
];

export const RECURRING_OPTIONS: Opt<RecurringShare>[] = [
  { value: 'u25', label: 'Unter 25 %' },
  { value: '25_50', label: '25–50 %' },
  { value: '50_75', label: '50–75 %' },
  { value: 'o75', label: 'Über 75 %' },
  { value: 'unknown', label: 'Weiß ich nicht' },
];

export const LARGEST_CUSTOMER_OPTIONS: Opt<LargestCustomer>[] = [
  { value: 'u10', label: 'Unter 10 %' },
  { value: '10_20', label: '10 bis 20 %' },
  { value: '20_30', label: '20 bis 30 %' },
  { value: 'o30', label: 'Über 30 %' },
  { value: 'none', label: 'Keine Angabe' },
];

export const EARNINGS_OPTIONS: Opt<Earnings>[] = [
  { value: 'profit', label: 'Gewinn' },
  { value: 'growth_loss', label: 'Verlust, weil wir bewusst in Wachstum investieren' },
];

/** EI6. The values also select the Q11 example (I48). */
export const BUSINESS_MODELS = [
  'Software / SaaS', 'IT- und Technologiedienstleistungen', 'Industrietechnologie', 'Produktion', 'Projektgeschäft',
  'Handel und Distribution', 'Sonstige Dienstleistungen', 'Sonstiges',
];
export const REVENUE_BANDS = ['Unter 5 Mio. €', '5–20 Mio. €', '20–50 Mio. €', '50–150 Mio. €', 'Über 150 Mio. €', 'Keine Angabe'];
export const EMPLOYEE_BANDS = ['Unter 25', '25–99', '100–249', '250–999', '1.000 oder mehr', 'Keine Angabe'];

export function labelOf<T extends string>(opts: Opt<T>[], v: T | null | undefined, fallback = 'Nicht angegeben'): string {
  return opts.find((o) => o.value === v)?.label ?? fallback;
}
