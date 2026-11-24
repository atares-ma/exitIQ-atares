// Core types for ExitIQ after the rebuild of 22/23 Nov 2026 (Änderungsliste
// "261122 ExitIQ Änderungsliste für Esma"). Plain data, so the same structures
// can be persisted, snapshotted and tested without a browser.

export type DimensionKey = 'S' | 'O' | 'T';
export type DomainKey =
  | 'S1' | 'S2' | 'S3'
  | 'O1' | 'O2' | 'O3' | 'O4' | 'O5'
  | 'T1' | 'T2' | 'T3' | 'T4';

export type Profile = 'OWNER' | 'CORPORATE' | 'PE' | 'VC';

/** Modules (RO2). A module is only ever on or off; there is no "pending" any more (RO1). */
export type RouteCode =
  | 'CORE' | 'RESTRUCTURING' | 'DEBT' | 'ACQUISITIONS' | 'CONTINGENT' | 'REGULATED' | 'EMPLOYEE_EQUITY'
  | 'INVESTOR_RIGHTS' | 'PE_CONTEXT' | 'SEPARATION' | 'ASSET_TRANSFER' | 'CROSS_BORDER' | 'PARTIAL' | 'PRIMARY_CAPITAL';
export type RouteMap = Record<RouteCode, boolean>;

export type Points = 0 | 50 | 100;

/**
 * Answer states (ST1–ST3):
 *  - substantive: one of the three statements (0 · 50 · 100)
 *  - clarify: "Muss ich erst klären" (open, no points, task)
 *  - lookup: "Muss ich erst nachsehen" (open, no points, task)
 *  - not_applicable: "Trifft auf uns nicht zu" (Q28, Q31, Q48, Q53 only), effective at once, local weight drops out
 */
export type AnswerStatus = 'substantive' | 'clarify' | 'lookup' | 'not_applicable';

export interface Answer {
  status: AnswerStatus;
  points?: Points;
  answeredAt: string;
  /** Extra line (Zusatzzeile): Q28 at 100 (RG4) and Q37 at 50 or 100 (RG3). */
  followUp?: 'yes' | 'no' | null;
  /** Set when the question left the scope and came back; the answer must be confirmed again. */
  requiresReconfirmation?: boolean;
  /** Set while the question is out of scope (answer kept, excluded from calculation). */
  inactiveSince?: string | null;
}

export type AnswerMap = Record<string, Answer>;

// ── Context page K1–K4 (section 3) ───────────────────────────────────────────

export type OwnershipTag = 'private_family' | 'corporate_group' | 'pe' | 'vc' | 'other';
export type ManagementModel = 'owner_led' | 'employed' | 'mixed';
/** K3 options (KO5). */
export type Intent = 'whole' | 'part' | 'shares' | 'investor' | 'open' | 'crisis';
export type Liquidity = 'no_pressure' | 'potential' | 'acute';

/** Codes derived from K3 (stored for reporting; routing reads `intents`). */
export type Objective = 'full_sale' | 'partial_sale' | 'succession' | 'growth_capital' | 'exploration' | 'distress';
export type Perimeter = 'whole_business' | 'subsidiary' | 'business_unit_assets' | 'undecided';

// ── Setup (section 4) ────────────────────────────────────────────────────────

export type Horizon = 'under_6' | 'm6_18' | 'm19_36' | 'over_36' | 'undecided';

/** Specialist topics (EI9). */
export type Topic =
  | 'debt' | 'acquisitions' | 'employee_equity' | 'regulated' | 'contingent' | 'shared_services' | 'restructuring' | 'cross_border_ops';

/** "Wer würde verkaufen?" (EI10). */
export type Seller = 'individuals_domestic' | 'individuals_foreign' | 'holding' | 'funds' | 'mixed' | 'unknown';
/** Follow-up "Wo sind die Verkäufer steuerpflichtig?" (holding, funds, mixed only). */
export type SellerTax = 'same' | 'different' | 'multiple' | 'unknown';

export type Country = 'DE' | 'AT' | 'CH' | 'other';
export type RecurringShare = 'u25' | '25_50' | '50_75' | 'o75' | 'unknown';
export type LargestCustomer = 'u10' | '10_20' | '20_30' | 'o30' | 'none';
export type Earnings = 'profit' | 'growth_loss';

export interface CompanyProfile {
  businessModel: string | null;
  sector: string | null;
  revenueBand: string | null;
  employeeBand: string | null;
  country: Country | null;
  recurringShare: RecurringShare | null;
  largestCustomer: LargestCustomer | null;
  earnings: Earnings | null;
}

export interface AssessmentContext {
  // K1–K4
  ownershipTags: OwnershipTag[];
  managementModel: ManagementModel | null;
  intents: Intent[];
  liquidity: Liquidity | null;
  // Setup page 1
  horizon: Horizon | null;
  /** Chosen perspective when K1 mixes perspectives, or an edit from the overview. Otherwise derived from K1 (EI5). */
  profileOverride: Profile | null;
  company: CompanyProfile;
  // Setup page 2
  topics: Topic[];
  /** "Nichts davon" was chosen. */
  topicsNone: boolean;
  /** Topics marked via "Bei einem Punkt bin ich unsicher" (P9). */
  uncertainTopics: Topic[];
  seller: Seller | null;
  sellerTax: SellerTax | null;
  /** Optional, only for perspective ≠ OWNER (EI11, R06). */
  fundingGapConfirmed: 'yes' | 'no' | null;
}

/** Status-line type per question (I46). */
export type StatusType = 'G' | 'F' | 'K' | 'N' | '-';

export interface Contributors {
  /** "Ansprechperson heute (sonst)". */
  default: string;
  /** inhabergeführt (N10). */
  owner: string;
  /** Familie, nicht inhabergeführt; null = wie heute. */
  family: string | null;
}

export interface QuestionText {
  question: string;
  /** [0 points, 50 points, 100 points] */
  anchors: [string, string, string];
}

export interface QuestionDef {
  id: string;
  domain: DomainKey;
  localWeight: 1 | 2 | 3;
  route: RouteCode;
  /** Kurztitel, used in tasks and lists. */
  name: string;
  chapter: number;
  statusType: StatusType;
  contributors: Contributors;
  /** Nachweis (ER10), its own field. */
  evidence: string;
  /** "Trifft auf uns nicht zu" offered (ST1: Q28, Q31, Q48, Q53). */
  naAllowed?: boolean;
  /** Base wording (Neu: Frage / Aussagen). */
  base: QuestionText;
}
