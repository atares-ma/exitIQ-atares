-- ExitIQ v2: complete database setup for a NEW Supabase project.
-- Paste into the SQL Editor and run once. Runs as one transaction and stops
-- without changes if the tables already exist.
begin;
-- ExitIQ v2 schema (rebuild per Änderungsliste 22/23 Nov 2026), for a fresh Supabase project.
-- Based on the v1 schema (Product and Implementation Brief, section 18).
--
-- Access model
--   * Every assessment belongs to exactly one auth user (owner_id). Visitors get
--     a real auth.uid() through Supabase anonymous sign-in, so ownership is
--     enforced by RLS on auth.uid() rather than on a self-asserted header.
--   * Default access is private to the owner. A respondent role is descriptive
--     and never grants access. Scoped contributors (release 2) will get their
--     own table and policies; nothing here grants cross-user access.
--   * Answers and result snapshots are append-only for clients: no UPDATE or
--     DELETE policies, so the audit trail cannot be rewritten from the browser.
--   * There are no reviewer-only states in v2: "Trifft auf uns nicht zu" takes effect at once.
--
-- The question catalogue is reference data, seeded by the following migration
-- and generated from src/model/catalogue.ts.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ── helpers ──────────────────────────────────────────────────────────────────

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── question catalogue (reference data) ──────────────────────────────────────

create table public.question_definitions (
  id                     text        not null,
  catalogue_version      text        not null,
  domain                 text        not null check (domain in ('S1','S2','S3','O1','O2','O3','O4','O5','T1','T2','T3','T4')),
  local_weight           smallint    not null check (local_weight between 1 and 3),
  route                  text        not null check (route in ('CORE','RESTRUCTURING','DEBT','ACQUISITIONS','CONTINGENT','REGULATED','EMPLOYEE_EQUITY','INVESTOR_RIGHTS','PE_CONTEXT','SEPARATION','ASSET_TRANSFER','CROSS_BORDER','PARTIAL','PRIMARY_CAPITAL')),
  name                   text        not null,
  question               text        not null,
  chapter                smallint    not null check (chapter between 1 and 8),
  status_type            text        not null check (status_type in ('G','F','K','N','-')),
  anchors                jsonb       not null check (jsonb_typeof(anchors) = 'array' and jsonb_array_length(anchors) = 3),
  evidence               text        not null,
  contributors           jsonb       not null,
  na_allowed             boolean     not null default false,
  depends_on             text[]      not null default '{}',
  created_at             timestamptz not null default now(),
  primary key (catalogue_version, id)
);

comment on table public.question_definitions is
  'Registered scored controls per catalogue version. Generated from src/model/catalogue.ts; do not edit by hand.';

create table public.profile_weights (
  catalogue_version text     not null,
  profile           text     not null check (profile in ('OWNER','CORPORATE','PE','VC')),
  domain            text     not null check (domain in ('S1','S2','S3','O1','O2','O3','O4','O5','T1','T2','T3','T4')),
  weight            smallint not null check (weight between 0 and 100),
  primary key (catalogue_version, profile, domain)
);

-- ── assessments ──────────────────────────────────────────────────────────────

create table public.assessments (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  stage              text        not null default 'CONTEXT'
                       check (stage in ('CONTEXT','CRISIS','SETUP','OVERVIEW','DEEP_ASSESSMENT','INTERIM','RESULT','SAVED')),
  resume_stage       text        check (resume_stage in ('CONTEXT','CRISIS','SETUP','OVERVIEW','DEEP_ASSESSMENT','INTERIM','RESULT')),
  subject            text        check (char_length(subject) <= 200),
  perimeter          text        check (perimeter in ('whole_business','subsidiary','business_unit_assets','undecided')),
  confirmed_profile  text        check (confirmed_profile in ('OWNER','CORPORATE','PE','VC')),
  ownership_tags     text[]      not null default '{}',
  objectives         text[]      not null default '{}',
  horizon            text        check (horizon in ('under_6','m6_18','m19_36','over_36','undecided')),
  jurisdictions      jsonb       not null default '{}'::jsonb,
  -- Full routing context (section 3), including UNKNOWN values. Bounded in size.
  context            jsonb       not null default '{}'::jsonb check (pg_column_size(context) <= 16384),
  -- Presentation state for resumption (current screen, question index). Never used for scoring.
  ui_state           jsonb       not null default '{}'::jsonb check (pg_column_size(ui_state) <= 4096),
  active_modules     text[]      not null default '{}',
  catalogue_version  text        not null,
  scoring_version    text        not null,
  report_version     text        not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index assessments_owner_idx on public.assessments (owner_id, updated_at desc);

create trigger assessments_updated_at
  before update on public.assessments
  for each row execute function private.set_updated_at();

-- Ownership never moves through an UPDATE from the client.
create or replace function private.lock_assessment_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger assessments_lock_owner
  before update on public.assessments
  for each row execute function private.lock_assessment_owner();

-- Ownership check used by every child-table policy. SECURITY DEFINER so the
-- policies do not recurse through assessments' own RLS; it only ever answers
-- for the calling user.
create or replace function private.owns_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id and a.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_assessment(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.owns_assessment(uuid) to authenticated;

-- ── answers (append-only history) ────────────────────────────────────────────
-- Each change appends a row; the current answer is the latest row per
-- (assessment, question). Inactive answers stay stored and are excluded from
-- calculation by the routing rules, never deleted.

create table public.answers (
  id                       uuid        primary key default gen_random_uuid(),
  assessment_id            uuid        not null references public.assessments (id) on delete cascade,
  question_id              text        not null check (question_id ~ '^Q[0-9]{2}$'),
  -- substantive = one of three statements; clarify / lookup = status line; not_applicable = "Trifft auf uns nicht zu".
  status                   text        not null check (status in ('substantive','clarify','lookup','not_applicable','cleared')),
  option_id                text        check (char_length(option_id) <= 40),
  points                   smallint    check (points in (0, 50, 100)),
  value                    jsonb       check (value is null or pg_column_size(value) <= 2048),
  respondent_id            uuid        not null default auth.uid(),
  respondent_role          text,
  source_version           text        not null,
  previous_answer_id       uuid        references public.answers (id) on delete set null,
  requires_reconfirmation  boolean     not null default false,
  inactive_since           timestamptz,
  created_at               timestamptz not null default now(),
  -- value carries the extra line (Zusatzzeile) of Q28/Q37: {"followUp": "yes"|"no"}.
  constraint answers_points_consistent check ((status = 'substantive') = (points is not null))
);

create index answers_assessment_question_idx on public.answers (assessment_id, question_id, created_at desc);
create index answers_previous_idx on public.answers (previous_answer_id);

create view public.current_answers
with (security_invoker = true) as
  select distinct on (assessment_id, question_id) *
  from public.answers
  order by assessment_id, question_id, created_at desc, id desc;

comment on view public.current_answers is 'Latest answer per assessment and question. Respects answers RLS (security_invoker).';

-- ── tasks ────────────────────────────────────────────────────────────────────

create table public.tasks (
  id                 uuid        primary key default gen_random_uuid(),
  assessment_id      uuid        not null references public.assessments (id) on delete cascade,
  task_key           text        not null check (char_length(task_key) <= 200),
  source_question_ids text[]     not null default '{}',
  rule_id            text,
  priority_class     smallint    not null check (priority_class in (1, 2, 3)),
  title              text        not null check (char_length(title) <= 300),
  reason             text        check (char_length(reason) <= 2000),
  accountable_role   text        check (char_length(accountable_role) <= 200),
  suggested_timing   text        check (char_length(suggested_timing) <= 100),
  agreed_due_date    date,
  dependencies       text[]      not null default '{}',
  evidence_required  text        check (char_length(evidence_required) <= 1000),
  status             text        not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  resolution         jsonb       check (resolution is null or pg_column_size(resolution) <= 4096),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (assessment_id, task_key)
);

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- ── result snapshots (append-only) ───────────────────────────────────────────

create table public.result_snapshots (
  id                 uuid        primary key default gen_random_uuid(),
  assessment_id      uuid        not null references public.assessments (id) on delete cascade,
  profile            text        check (profile in ('OWNER','CORPORATE','PE','VC')),
  catalogue_version  text        not null,
  scoring_version    text        not null,
  report_version     text        not null,
  data_status        text        not null check (data_status in ('data_complete','data_incomplete')),
  risk_status        text        not null check (risk_status in ('critical','review','none')),
  result             jsonb       not null check (pg_column_size(result) <= 262144),
  created_at         timestamptz not null default now()
);

create index result_snapshots_assessment_idx on public.result_snapshots (assessment_id, created_at desc);

-- ── analytics (section 20: minimal metadata, no answer content) ──────────────

create table public.analytics_events (
  id             bigint      generated always as identity primary key,
  assessment_id  uuid        references public.assessments (id) on delete set null,
  user_id        uuid        default auth.uid(),
  event          text        not null check (event in (
                    'stage_view','assessment_start','theme_complete','route_change','save','resume','result_view','contact_request','export')),
  stage          text        check (char_length(stage) <= 40),
  broad_context  text        check (broad_context in ('OWNER','CORPORATE','PE','VC')),
  device         text        check (device in ('mobile','tablet','desktop')),
  channel        text        check (char_length(channel) <= 60),
  is_internal    boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index analytics_events_assessment_idx on public.analytics_events (assessment_id);
create index analytics_events_created_idx on public.analytics_events (created_at);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.question_definitions enable row level security;
alter table public.profile_weights      enable row level security;
alter table public.assessments          enable row level security;
alter table public.answers              enable row level security;
alter table public.tasks                enable row level security;
alter table public.result_snapshots     enable row level security;
alter table public.analytics_events     enable row level security;

-- Reference data: readable by everyone, written only by migrations.
create policy "catalogue is public" on public.question_definitions for select to anon, authenticated using (true);
create policy "weights are public"  on public.profile_weights      for select to anon, authenticated using (true);

-- Assessments: owner only.
create policy "owner reads assessments"   on public.assessments for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates assessments" on public.assessments for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates assessments" on public.assessments for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes assessments" on public.assessments for delete to authenticated using (owner_id = (select auth.uid()));

-- Answers: owner reads and appends. Reviewer-only states are refused.
create policy "owner reads answers" on public.answers for select to authenticated
  using ((select private.owns_assessment(assessment_id)));
create policy "owner appends answers" on public.answers for insert to authenticated
  with check (
    (select private.owns_assessment(assessment_id))
    and respondent_id = (select auth.uid())
  );

-- Tasks: owner maintains the plan.
create policy "owner reads tasks"   on public.tasks for select to authenticated using ((select private.owns_assessment(assessment_id)));
create policy "owner creates tasks" on public.tasks for insert to authenticated with check ((select private.owns_assessment(assessment_id)));
create policy "owner updates tasks" on public.tasks for update to authenticated
  using ((select private.owns_assessment(assessment_id))) with check ((select private.owns_assessment(assessment_id)));
create policy "owner deletes tasks" on public.tasks for delete to authenticated using ((select private.owns_assessment(assessment_id)));

-- Snapshots: owner reads and appends.
create policy "owner reads snapshots"   on public.result_snapshots for select to authenticated using ((select private.owns_assessment(assessment_id)));
create policy "owner appends snapshots" on public.result_snapshots for insert to authenticated with check ((select private.owns_assessment(assessment_id)));

-- Analytics: write-only for clients; reading is for the service role.
create policy "user records own events" on public.analytics_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (assessment_id is null or (select private.owns_assessment(assessment_id)))
  );

-- ── grants ───────────────────────────────────────────────────────────────────
-- Explicit, so the Data API exposes exactly this and nothing more.

revoke all on public.question_definitions, public.profile_weights, public.assessments, public.answers,
              public.tasks, public.result_snapshots, public.analytics_events,
              public.current_answers
  from anon, authenticated;

grant select on public.question_definitions, public.profile_weights to anon, authenticated;
grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert on public.answers to authenticated;
grant select on public.current_answers to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.result_snapshots to authenticated;
grant insert on public.analytics_events to authenticated;

-- GENERATED by `npm run gen:catalogue-sql` from src/model/catalogue.ts. Do not edit by hand.
insert into public.question_definitions
  (id, catalogue_version, domain, local_weight, route, name, question, chapter, status_type, anchors, evidence, contributors, na_allowed)
values
  ('Q01', 'catalogue-2026.11-v2.0', 'S1', 2, 'CORE', 'Ziele des Verkaufs', 'Haben Sie festgelegt, was Ihnen beim Verkauf am wichtigsten ist, z. B. Preis, Mitarbeitende, Ihre Rolle oder der Zeitpunkt?', 1, 'G', '["Nein, noch nicht.","Die Ziele kennen wir, die Reihenfolge ist offen.","Ja, Ziele und Reihenfolge sind schriftlich festgehalten."]'::jsonb, 'Datiertes Zielpapier mit Rangfolge der Ziele', '{"default":"Führender Gesellschafter / Finanzinvestor","owner":"Sie","family":"Führender Gesellschafter"}'::jsonb, false),
  ('Q02', 'catalogue-2026.11-v2.0', 'S1', 1, 'CORE', 'Zeitplan und Vorbereitung', 'Haben Sie einen Zeitplan, der zeigt, was bis zur Ansprache der Käufer noch zu erledigen ist?', 1, 'G', '["Nein, es gibt noch keinen Zeitplan.","Ein Zieltermin steht, die Schritte dahin sind nicht geplant.","Ja, Zieltermin und Schritte in sinnvoller Reihenfolge sind festgehalten."]'::jsonb, 'Datierter Zeitplan mit Vorbereitungsschritten, Reihenfolge und Verantwortlichen', '{"default":"Transaktionsleitung","owner":"Sie","family":"Sie / Ihr M&A-Berater"}'::jsonb, false),
  ('Q44', 'catalogue-2026.11-v2.0', 'S1', 3, 'SEPARATION', 'Abgrenzung des Verkaufsumfangs', 'Ist festgelegt, was genau zum verkauften Teil gehört, also Gesellschaften, Mitarbeitende, Verträge, Anlagen und Verpflichtungen?', 1, 'K', '["Nein, die Grenzen sind noch offen.","Ein Entwurf steht, einzelne Zuordnungen sind offen.","Ja, alles ist zugeordnet und festgehalten."]'::jsonb, 'Perimeterübersicht (Gesellschaften, Mitarbeitende, Vermögenswerte, Verträge, Verpflichtungen) zum Stichtag', '{"default":"Konzern-M&A / Recht","owner":"Sie oder Ihr M&A-Berater","family":"Geschäftsführung / Ihr Anwalt"}'::jsonb, false),
  ('Q05', 'catalogue-2026.11-v2.0', 'S3', 2, 'CORE', 'Wege für den Verkauf', 'Haben Sie verglichen, welche Wege für einen Verkauf in Frage kommen, z. B. an ein anderes Unternehmen, einen Finanzinvestor, Ihr Management oder in der Familie?', 1, 'G', '["Nein, noch nicht verglichen.","Die Wege kennen wir, Vor- und Nachteile sind nicht abgewogen.","Ja, Vor- und Nachteile sind gegen unsere Ziele abgewogen und festgehalten."]'::jsonb, 'Datierter Vergleich der Verkaufswege mit Vor- und Nachteilen, gemessen an den Zielen aus Q01', '{"default":"Transaktionsleitung / Berater","owner":"Sie oder Ihr M&A-Berater","family":"Sie / Ihr M&A-Berater"}'::jsonb, false),
  ('Q06', 'catalogue-2026.11-v2.0', 'S3', 2, 'CORE', 'Künftige Rolle der Führung', 'Haben Sie festgelegt, welche Rolle Sie nach dem Verkauf übernehmen und wie lange?', 1, 'F', '["Nein, das ist noch offen.","Rolle und Dauer stehen, für ausscheidende Personen fehlt ein Nachfolger.","Ja, Rolle und Dauer stehen; wo jemand ausscheidet, ist ein Nachfolger benannt."]'::jsonb, 'Datierte Notiz zu Rolle, Dauer der Übergangszeit und, wo jemand ausscheidet, benanntem Nachfolger', '{"default":"Management / Eigentümer","owner":"Sie","family":null}'::jsonb, false),
  ('Q50', 'catalogue-2026.11-v2.0', 'S3', 2, 'PE_CONTEXT', 'Wertsteigerung seit Einstieg', 'Können Sie mit Zahlen zeigen, welche Verbesserungen seit dem Einstieg des Investors auf eigene Maßnahmen zurückgehen und nicht auf den Markt?', 1, 'N', '["Nein, das ist nicht belegt.","Die wichtigsten Maßnahmen sind belegt, eine Ergebnisüberleitung fehlt.","Ja, Maßnahmen und Ergebniswirkung sind übergeleitet, Grenzen sind benannt."]'::jsonb, 'Wertsteigerungsbrücke seit Einstieg (Ergebnisbeitrag je Maßnahme, Markteffekt getrennt)', '{"default":"Finanzinvestor / CFO","owner":"Finanzinvestor / CFO","family":null}'::jsonb, false),
  ('Q03', 'catalogue-2026.11-v2.0', 'S2', 3, 'CORE', 'Einigkeit der Entscheider', 'Sind sich alle, die über den Verkauf mitentscheiden, über die Ziele einig?', 1, 'G', '["Nein, es gibt grundlegende Meinungsunterschiede.","Weitgehend, einzelne wichtige Punkte sind offen.","Ja, gemeinsam beschlossen, oder ich entscheide allein."]'::jsonb, 'Gesellschafterbeschluss oder gemeinsames Zielpapier der Gesellschafter', '{"default":"Führender Gesellschafter / Gremien","owner":"Sie","family":"Führender Gesellschafter"}'::jsonb, false),
  ('Q04', 'catalogue-2026.11-v2.0', 'S2', 2, 'CORE', 'Zustimmungen zum Verkauf', 'Haben Sie geklärt, wer einem Verkauf zustimmen muss (z. B. Mitgesellschafter, Beirat, Ehepartner)?', 1, 'G', '["Nein, das haben wir nicht geklärt.","Die Beteiligten kennen wir, Ablauf und Zeitpunkt sind offen.","Ja, Zustimmungen, Ablauf und Zeitplan sind festgehalten."]'::jsonb, 'Übersicht erforderlicher Zustimmungen (Gesellschaftsvertrag, Beirat, ggf. Ehepartner) mit Zeitplan', '{"default":"Recht / Gremienbüro","owner":"Sie oder Ihr Anwalt","family":"Recht / Ihr Anwalt"}'::jsonb, false),
  ('Q54', 'catalogue-2026.11-v2.0', 'S2', 3, 'PARTIAL', 'Mitsprache des neuen Investors', 'Ist unter den Gesellschaftern abgestimmt, welche Mitsprache ein neuer Investor nach dem Teilverkauf bekommen soll, z. B. Beirat oder Zustimmungsrechte?', 1, 'G', '["Nein, darüber haben wir nicht gesprochen.","Erste Vorstellungen gibt es, wichtige Punkte sind offen.","Ja, unsere Vorstellungen und Grenzen für die Verhandlung sind festgehalten."]'::jsonb, 'Eckpunktepapier zur künftigen Governance (Beirat, Zustimmungsvorbehalte, Mitverkaufsrechte, Exit-Regeln)', '{"default":"Gesellschafter / Recht","owner":"Sie oder Ihr Anwalt","family":"Gesellschafter / Ihr Anwalt"}'::jsonb, false),
  ('Q07', 'catalogue-2026.11-v2.0', 'O1', 3, 'CORE', 'Dauerhafter Gewinn', 'Können Sie erklären, welchen Gewinn Ihr Unternehmen dauerhaft erwirtschaftet, also ohne einmalige Erträge oder Kosten?', 2, 'F', '["Nein, das haben wir noch nicht hergeleitet.","Die Treiber kennen wir, eine saubere Herleitung fehlt.","Ja, hergeleitet und mit bereinigten Zahlen belegt."]'::jsonb, 'Datiertes Dokument mit verantwortlicher Person, das den bereinigten, dauerhaften Gewinn herleitet', '{"default":"CFO","owner":"Sie","family":null}'::jsonb, false),
  ('Q08', 'catalogue-2026.11-v2.0', 'O1', 2, 'CORE', 'Liquiditätsplanung', 'Haben Sie eine Liquiditätsplanung für die nächsten 12 Monate?', 2, 'F', '["Nein, keine laufende Planung.","Ja, aber ohne Szenarien und Gegenmaßnahmen.","Ja, laufend gepflegt, mit Szenarien und finanzierten Gegenmaßnahmen."]'::jsonb, 'Datierte Liquiditätsplanung über 12 Monate mit Szenarien und verantwortlicher Person', '{"default":"CFO","owner":"Sie","family":null}'::jsonb, false),
  ('Q19', 'catalogue-2026.11-v2.0', 'O5', 2, 'CORE', 'Belegbare Kundenvorteile', 'Können Sie belegen, warum sich Kunden für Ihr Produkt oder Ihre Leistung entscheiden?', 2, 'F', '["Nein, das beruht auf unserer Einschätzung.","Teilweise, zum Beispiel einzelne Referenzen oder Kundenstimmen.","Ja, zum Beispiel mit Kundenbefragungen, Referenzen oder Zahlen zu Wiederkauf und Preisen."]'::jsonb, 'Datierte Sammlung von Kundennachweisen (Befragung, Referenzen, Wiederkaufquote)', '{"default":"Vertriebs- / Produktleitung","owner":"Sie","family":null}'::jsonb, false),
  ('Q20', 'catalogue-2026.11-v2.0', 'O5', 2, 'CORE', 'Weiterentwicklung des Angebots', 'Wissen Sie, wie Sie Ihr Angebot als Nächstes weiterentwickeln?', 2, 'K', '["Nein, Prioritäten sind nicht festgelegt.","Die Prioritäten stehen, ein Umsetzungsplan fehlt.","Ja, mit Budget, Personal, Meilensteinen und Erfolgskennzahlen."]'::jsonb, 'Datierte Planung mit Prioritäten, Ressourcen, Meilensteinen und verantwortlicher Person', '{"default":"Produkt / Strategie","owner":"Sie","family":null}'::jsonb, false),
  ('Q09', 'catalogue-2026.11-v2.0', 'O2', 3, 'CORE', 'Wegfall eines großen Kunden', 'Wissen Sie, was Sie tun würden, wenn ein großer Kunde wegfällt?', 3, 'K', '["Nein, darüber haben wir noch nicht nachgedacht.","Die Auswirkung kennen wir, ein Plan fehlt noch.","Ja, Gegenmaßnahmen sind festgehalten, oder kein Kunde bringt über 10 % Umsatz."]'::jsonb, 'Kundenliste mit Umsatzanteilen und Gegenmaßnahmen', '{"default":"Vertriebsleitung / CFO","owner":"Sie","family":null}'::jsonb, false),
  ('Q10', 'catalogue-2026.11-v2.0', 'O2', 2, 'CORE', 'Kundenbindung', 'Können Sie mit Zahlen zeigen, dass Ihre Kunden bleiben und wieder kaufen?', 3, 'F', '["Nein, das werten wir nicht aus.","Teilweise, die Zahlen sind lückenhaft.","Ja, mit Zahlen über mehrere Jahre, z. B. Wiederkaufquote oder Vertragslaufzeiten."]'::jsonb, 'Auswertung Kundenbindung über 3 Jahre plus Vertragsübersicht', '{"default":"Vertriebsleitung","owner":"Sie","family":null}'::jsonb, false),
  ('Q11', 'catalogue-2026.11-v2.0', 'O2', 1, 'CORE', 'Ausfall eines Lieferanten', 'Könnten Sie Ihre Leistung weiter erbringen, wenn ein wichtiger Lieferant oder Dienstleister ausfällt, z. B. ein Zulieferer oder Cloud-Anbieter?', 3, 'F', '["Nein, dafür gibt es keine Vorsorge.","Alternativen sind bekannt, aber nicht vorbereitet.","Ja, Ausweichlösungen sind vorbereitet, oder wir hängen von keinem einzelnen Anbieter ab."]'::jsonb, 'Liste kritischer Lieferanten und Dienstleister mit Ausweichlösung', '{"default":"Operations","owner":"Sie","family":null}'::jsonb, false),
  ('Q15', 'catalogue-2026.11-v2.0', 'O4', 2, 'CORE', 'Beschriebene Abläufe', 'Könnte eine neue Person die wichtigsten Abläufe anhand Ihrer Unterlagen erledigen?', 3, 'F', '["Nein, das Wissen steckt in den Köpfen.","Teilweise, einige Abläufe sind beschrieben.","Ja, beschrieben und mit festen Verantwortlichen."]'::jsonb, 'Prozessbeschreibungen mit Verantwortlichen', '{"default":"Operations","owner":"Sie","family":null}'::jsonb, false),
  ('Q16', 'catalogue-2026.11-v2.0', 'O4', 2, 'CORE', 'Engpässe bei mehr Nachfrage', 'Wissen Sie, was Sie bei deutlich mehr Nachfrage bremsen würde und wie Sie das lösen?', 3, 'K', '["Nein, das haben wir nicht geprüft.","Die Engpässe kennen wir, Lösungen fehlen noch.","Ja, Engpässe und Lösungen mit Ressourcen sind festgehalten."]'::jsonb, 'Engpassanalyse mit Maßnahmen und Ressourcen', '{"default":"Operations / CFO","owner":"Sie","family":null}'::jsonb, false),
  ('Q17', 'catalogue-2026.11-v2.0', 'O4', 2, 'CORE', 'Wiederherstellung der IT', 'Könnten Sie Ihre wichtigen IT-Systeme nach einem längeren Ausfall wiederherstellen?', 3, 'K', '["Nein, dafür gibt es keine Vorkehrungen.","Vorkehrungen gibt es, aber mit Lücken oder ohne Tests.","Ja, festgehalten und regelmäßig getestet."]'::jsonb, 'Notfallplan mit Datum des letzten Tests', '{"default":"IT / Informationssicherheit","owner":"IT-Verantwortliche, intern oder Dienstleister","family":null}'::jsonb, false),
  ('Q18', 'catalogue-2026.11-v2.0', 'O4', 2, 'ACQUISITIONS', 'Offene Punkte aus Zukäufen', 'Haben Sie einen Plan für offene Punkte aus früheren Zukäufen, z. B. für die Integration oder ausstehende Kaufpreiszahlungen (Earn-outs)?', 3, 'F', '["Nein, für offene Punkte gibt es keinen Plan.","Einen Plan gibt es, Verantwortliche oder Termine fehlen.","Ja, jeder Punkt hat Verantwortliche und Termine, der Stand wird verfolgt."]'::jsonb, 'Integrationsplan je Zukauf mit offenen Punkten, Verantwortlichen, Terminen und laufenden Earn-outs', '{"default":"Integrationsleitung","owner":"Sie","family":"Geschäftsführung"}'::jsonb, false),
  ('Q47', 'catalogue-2026.11-v2.0', 'O4', 3, 'SEPARATION', 'Trennung der IT-Systeme', 'Ist geklärt, wie der verkaufte Teil seine IT-Systeme und Daten nach dem Verkauf nutzen oder abtrennen kann?', 3, 'K', '["Nein, das ist nicht geplant.","Ein Plan steht, mit Lücken, z. B. bei Lizenzen oder Daten.","Ja, Rechte, Ablauf und Übergangsbetrieb stehen fest, oder die Systeme sind schon getrennt."]'::jsonb, 'IT-Trennungsplan mit Lizenzrechten, Datentrennung, Ablauf und Übergangsbetrieb', '{"default":"IT / Recht","owner":"IT-Verantwortliche, intern oder Dienstleister","family":"IT / Ihr Anwalt"}'::jsonb, false),
  ('Q12', 'catalogue-2026.11-v2.0', 'O3', 3, 'CORE', 'Vertretung bei Entscheidungen', 'Was würde ins Stocken geraten, wenn Sie vier Wochen nicht da wären?', 4, 'F', '["Vieles, auch Alltagsentscheidungen müssten warten.","Das Tagesgeschäft läuft, einzelne wichtige Entscheidungen müssten warten.","Nichts Wesentliches; Vertretung und Befugnisse sind schriftlich geregelt."]'::jsonb, 'Vertretungsregelung mit Vollmachten (z. B. Prokura, Freigabegrenzen)', '{"default":"Geschäftsführung","owner":"Sie","family":null}'::jsonb, false),
  ('Q13', 'catalogue-2026.11-v2.0', 'O3', 2, 'CORE', 'Vertretung für Fachwissen', 'Könnte jemand anderes die Arbeit Ihrer wichtigsten Fachleute übernehmen, wenn diese länger ausfallen?', 4, 'F', '["Nein, dafür gibt es niemanden.","Eine Vertretung ist benannt, aber nicht eingearbeitet.","Ja, die Vertretung ist eingearbeitet und das Wissen übergeben."]'::jsonb, 'Vertretungsplan für Schlüsselpersonen mit Stand der Einarbeitung', '{"default":"Operations / Personalleitung","owner":"Sie","family":null}'::jsonb, false),
  ('Q14', 'catalogue-2026.11-v2.0', 'O3', 2, 'CORE', 'Ansprechpartner der Schlüsselkunden', 'Haben Ihre wichtigsten Kunden mehr als einen festen Ansprechpartner bei Ihnen?', 4, 'F', '["Nein, alles läuft über eine Person.","Weitere Kontakte gibt es, die Zuständigkeit ist aber nicht geregelt.","Ja, jeder hat feste Zuständige und eine Vertretung."]'::jsonb, 'Übersicht Schlüsselkunden mit Zuständigen und Vertretung', '{"default":"Vertriebsleitung","owner":"Sie","family":null}'::jsonb, false),
  ('Q46', 'catalogue-2026.11-v2.0', 'O3', 3, 'SEPARATION', 'Gemeinsam genutzte Leistungen', 'Ist geklärt, wie Leistungen, die heute vom Konzern oder vom übrigen Unternehmen kommen (z. B. IT, Buchhaltung, Einkauf), nach dem Verkauf weiterlaufen?', 4, 'K', '["Nein, dafür gibt es noch keine Lösung.","Die Leistungen sind erfasst, einzelne Lösungen fehlen.","Ja, jede Leistung hat eine Lösung, oder es gibt keine."]'::jsonb, 'Liste gemeinsam genutzter Leistungen mit Lösung (Übernahme, Übergangsvereinbarung, Neuaufbau) und Verantwortlichen', '{"default":"Separierungsleitung","owner":"Sie","family":"Geschäftsführung"}'::jsonb, false),
  ('Q21', 'catalogue-2026.11-v2.0', 'T1', 3, 'CORE', 'Zahlen der letzten drei Jahre', 'Könnten Sie einem Käufer Ihre Zahlen der letzten drei Jahre so vorlegen, dass alles zusammenpasst?', 5, 'K', '["Nein, Unterlagen fehlen oder passen nicht zusammen.","Abschlüsse und Monatszahlen liegen vor, die Bereinigung um Einmaliges fehlt.","Ja, Monatszahlen, Abschlüsse und die Bereinigung um einmalige Erträge und Kosten passen zusammen."]'::jsonb, 'Finanzpaket 3 Jahre (Abschlüsse, Monatszahlen, Überleitung der Bereinigungen) mit verantwortlicher Person', '{"default":"CFO","owner":"Sie oder Ihr Steuerberater","family":null}'::jsonb, false),
  ('Q45', 'catalogue-2026.11-v2.0', 'T1', 3, 'SEPARATION', 'Eigene Zahlen des verkauften Teils', 'Können Sie die Zahlen des verkauften Teils so zeigen, als wäre er schon eigenständig?', 5, 'K', '["Nein, eigene Zahlen für den Teil gibt es nicht.","Zahlen gibt es, die Aufteilung gemeinsamer Kosten ist offen.","Ja, eigene Zahlen mit erklärter Kostenaufteilung liegen vor."]'::jsonb, 'Carve-out-Zahlen für 3 Jahre mit Schlüsseln für gemeinsame Kosten und Stand-alone-Anpassungen', '{"default":"CFO / Carve-out-Finanzteam","owner":"Sie oder Ihr Steuerberater","family":"CFO / Ihr Steuerberater"}'::jsonb, false),
  ('Q22', 'catalogue-2026.11-v2.0', 'T1', 2, 'CORE', 'Planung mit erklärten Annahmen', 'Haben Sie eine Planung für die nächsten Jahre, deren Annahmen Sie erklären können?', 5, 'F', '["Nein, es gibt keine Planung.","Es gibt eine Planung, die Annahmen sind nicht festgehalten.","Ja, jede Planzahl beruht auf einer festgehaltenen Annahme."]'::jsonb, 'Mehrjahresplanung mit dokumentierten Annahmen (Kunden, Preise, Personal)', '{"default":"CFO","owner":"Sie","family":null}'::jsonb, false),
  ('Q23', 'catalogue-2026.11-v2.0', 'T1', 2, 'CORE', 'Abzüge und Zuschläge zum Kaufpreis', 'Wissen Sie, welche Schulden, Pensionszusagen und Bankguthaben beim Verkauf vom Kaufpreis abgezogen oder hinzugerechnet werden?', 5, 'N', '["Nein, damit haben wir uns noch nicht befasst.","Die großen Posten kennen wir, eine vollständige Aufstellung fehlt.","Ja, alle Posten sind mit aktuellen Beträgen aufgestellt."]'::jsonb, 'Aufstellung Finanzschulden, schuldenähnliche Posten (inkl. offene Kaufpreiszahlungen, Auszahlungen aus Beteiligungen) und Barmittel zum Stichtag', '{"default":"CFO / Transaktionsberater","owner":"Sie oder Ihr M&A-Berater","family":null}'::jsonb, false),
  ('Q24', 'catalogue-2026.11-v2.0', 'T1', 3, 'DEBT', 'Zustimmung der Banken', 'Wissen Sie, ob Ihre Banken einem Verkauf zustimmen müssen und wie Sicherheiten freigegeben werden, z. B. Ihre persönlichen Bürgschaften oder Grundschulden?', 5, 'N', '["Nein, das haben wir nicht geprüft.","Das wissen wir, das Vorgehen ist aber nicht geplant.","Ja, geprüft; nötige Zustimmungen und Zeitplan sind festgehalten."]'::jsonb, 'Übersicht Kreditverträge mit Kontrollwechselklauseln, Sicherheiten und Zeitplan', '{"default":"CFO / Recht","owner":"Sie","family":"CFO / Ihr Anwalt"}'::jsonb, false),
  ('Q55', 'catalogue-2026.11-v2.0', 'T1', 2, 'PRIMARY_CAPITAL', 'Mittelverwendung und Verkaufserlöse', 'Ist klar getrennt, wie viel Geld ins Unternehmen fließt und wie viel an Gesellschafter, die Anteile verkaufen?', 5, 'G', '["Nein, das ist nicht getrennt.","Eine grobe Aufteilung gibt es, ein Finanzierungsplan fehlt.","Ja, Mittelverwendung und Verkaufserlöse sind getrennt geplant, oder alles fließt ins Unternehmen."]'::jsonb, 'Mittelverwendungsplan für das neue Kapital, verknüpft mit der Planung aus Q22, plus Aufstellung etwaiger Verkaufserlöse', '{"default":"CFO / Gesellschafter","owner":"Sie","family":null}'::jsonb, false),
  ('Q25', 'catalogue-2026.11-v2.0', 'T2', 3, 'CORE', 'Steuerliche Vorbereitung und Optimierung', 'Hat ein Steuerberater geprüft, wie Sie den Verkauf steuerlich am besten gestalten (z. B. Anteile direkt, über eine Holding, nur der Geschäftsbetrieb)?', 6, 'G', '["Nein, noch nicht.","Wir haben es allgemein besprochen, ein Vergleich fehlt.","Ja, ein Steuerberater mit Erfahrung bei Unternehmensverkäufen hat die Verkaufsformen verglichen und schriftlich festgehalten."]'::jsonb, 'Datierter steuerlicher Vergleich der Verkaufsformen mit Annahmen und Auftrag des Steuerberaters', '{"default":"Verkäufer / steuerliche Leitung","owner":"Sie oder Ihr Steuerberater","family":"Sie / Ihr Steuerberater"}'::jsonb, false),
  ('Q26', 'catalogue-2026.11-v2.0', 'T2', 3, 'CORE', 'Wer verkauft und wo steuerpflichtig', 'Ist festgehalten, wer genau verkauft und wo die Verkäufer steuerpflichtig sind?', 6, 'G', '["Nein, das ist nicht zusammengestellt.","Grob ja, Beteiligungen oder Holdings sind nicht vollständig erfasst.","Ja, alle Verkäufer mit Rechtsform, Anteil und Steuersitz sind erfasst."]'::jsonb, 'Gesellschafterübersicht mit Rechtsform, Anteilen und Steuersitz', '{"default":"Steuerberater","owner":"Ihr Steuerberater","family":"Ihr Steuerberater"}'::jsonb, false),
  ('Q28', 'catalogue-2026.11-v2.0', 'T2', 3, 'RESTRUCTURING', 'Sperrfristen aus Umstrukturierungen', 'Hat Ihr Steuerberater geprüft, ob frühere Umstrukturierungen einen Verkauf steuerlich einschränken (z. B. Sperrfristen)?', 6, 'K', '["Nein, das wurde nicht geprüft.","Die Unterlagen sind gesammelt, eine Beurteilung fehlt noch.","Ja, geprüft; Fristen oder Einschränkungen sind festgehalten."]'::jsonb, 'Prüfvermerk des Steuerberaters zu früheren Umstrukturierungen und Fristen', '{"default":"Steuerberater","owner":"Ihr Steuerberater","family":"Ihr Steuerberater"}'::jsonb, true),
  ('Q29', 'catalogue-2026.11-v2.0', 'T2', 2, 'CORE', 'Offene Steuerthemen', 'Haben Sie prüfen lassen, ob es offene Steuerthemen gibt, die ein Käufer finden könnte?', 6, 'K', '["Nein, das haben wir nicht geprüft.","Teilweise, z. B. bei der letzten Betriebsprüfung; seither nicht systematisch.","Ja, geprüft; Themen sind bewertet und zugeordnet, oder es gibt keine."]'::jsonb, 'Liste steuerlicher Themen seit der letzten Betriebsprüfung mit Bewertung und Verantwortlichen', '{"default":"Steuerberater / CFO","owner":"Sie oder Ihr Steuerberater","family":null}'::jsonb, false),
  ('Q31', 'catalogue-2026.11-v2.0', 'T2', 3, 'CONTINGENT', 'Steuern auf Earn-out oder Rückbeteiligung', 'Hat Ihr Steuerberater geprüft, wie ein erfolgsabhängiger oder später gezahlter Kaufpreisteil oder eine Rückbeteiligung besteuert würde?', 6, 'G', '["Nein, das wurde nicht geprüft.","Grundsätzlich besprochen, die steuerliche Behandlung ist nicht festgehalten.","Ja, Behandlung und Annahmen sind festgehalten."]'::jsonb, 'Steuerliche Stellungnahme zu Earn-out, Rückbeteiligung bzw. aufgeschobener Zahlung', '{"default":"Steuerberater der Verkäufer","owner":"Ihr Steuerberater","family":null}'::jsonb, true),
  ('Q49', 'catalogue-2026.11-v2.0', 'T2', 3, 'SEPARATION', 'Steuerfolgen der Herauslösung', 'Hat ein Steuerberater geprüft, welche Steuerfolgen das Herauslösen des verkauften Teils hat, z. B. Ende einer Organschaft oder interne Verrechnungen?', 6, 'K', '["Nein, das wurde nicht geprüft.","Eine erste Prüfung gibt es, wichtige Punkte sind offen.","Ja, Steuerfolgen und Abhängigkeiten sind festgehalten."]'::jsonb, 'Steuerliche Stellungnahme zur Separierung (Organschaft, interne Salden, Verrechnungspreise, Umstrukturierungsschritte)', '{"default":"Steuerberater / Konzernsteuerabteilung","owner":"Ihr Steuerberater","family":"Ihr Steuerberater"}'::jsonb, false),
  ('Q52', 'catalogue-2026.11-v2.0', 'T2', 3, 'CROSS_BORDER', 'Steuerberater in allen Ländern', 'Gibt es für alle betroffenen Länder einen Steuerberater, und stimmt sich einer federführend mit allen ab?', 6, 'K', '["Nein, nicht alle Länder sind abgedeckt.","Berater sind benannt, Aufgaben oder Abstimmung sind offen.","Ja, Länder, Berater, Federführung und Zeitplan sind festgehalten."]'::jsonb, 'Übersicht der Länder mit zuständigen Beratern, Federführung und Arbeitsplan', '{"default":"Federführender Steuerberater","owner":"Ihr Steuerberater","family":null}'::jsonb, false),
  ('Q32', 'catalogue-2026.11-v2.0', 'T3', 3, 'CORE', 'Nachweis der Anteile', 'Können Sie lückenlos belegen, wem die Anteile an Ihrem Unternehmen gehören?', 7, 'N', '["Nein, es gibt Lücken in den Unterlagen.","Weitgehend, einzelne Punkte sind offen.","Ja, Gesellschafterliste und alle Übertragungen, z. B. Erbe oder Schenkung, sind belegt."]'::jsonb, 'Aktuelle Gesellschafterliste, Gesellschaftsvertrag und Nachweise aller Anteilsübertragungen', '{"default":"Recht","owner":"Sie oder Ihr Anwalt","family":"Recht / Ihr Anwalt oder Notar"}'::jsonb, false),
  ('Q33', 'catalogue-2026.11-v2.0', 'T3', 3, 'CORE', 'Rechte an Software, Marken und Inhalten', 'Können Sie belegen, dass Ihrem Unternehmen die Rechte an Software, Marken und Inhalten gehören, die es selbst entwickelt hat oder entwickeln ließ?', 7, 'K', '["Nein, das ist nicht geregelt.","Größtenteils; bei Freelancern oder Lizenzen ist manches unklar.","Ja, alles schriftlich belegt, oder wir nutzen nur Standardlizenzen."]'::jsonb, 'Übersicht wesentlicher Rechte (Software, Marken) mit Verträgen zur Rechteübertragung und Lizenzen', '{"default":"Recht / Technologieleitung","owner":"Sie oder Ihr Anwalt","family":"Technologieleitung / Ihr Anwalt"}'::jsonb, false),
  ('Q53', 'catalogue-2026.11-v2.0', 'T3', 3, 'ASSET_TRANSFER', 'Übertragung von Verträgen und Anlagen', 'Haben Sie erfasst, was für die Übertragung von Verträgen, Mitarbeitenden und Anlagen nötig ist, z. B. Zustimmungen von Vertragspartnern?', 7, 'K', '["Nein, das haben wir nicht geprüft.","Die Anforderungen sind erfasst, wichtige Punkte sind offen.","Ja, alle Übertragungen und Schritte mit Dritten sind festgehalten."]'::jsonb, 'Übertragungsliste (Verträge mit Zustimmungserfordernis, Übergang der Mitarbeitenden, Schutzrechte, Genehmigungen)', '{"default":"Recht","owner":"Sie oder Ihr Anwalt","family":"Recht / Ihr Anwalt"}'::jsonb, true),
  ('Q34', 'catalogue-2026.11-v2.0', 'T3', 2, 'CORE', 'Wichtige Verträge beim Verkauf', 'Haben Sie geprüft, ob wichtige Verträge, z. B. mit großen Kunden, Lieferanten oder dem Vermieter, bei einem Verkauf gekündigt werden können oder eine Zustimmung brauchen?', 7, 'K', '["Nein, das haben wir nicht geprüft.","Die wichtigsten Verträge sind geprüft, Folgeschritte sind offen.","Ja, geprüft; nötige Zustimmungen und Schritte sind festgehalten."]'::jsonb, 'Übersicht wesentlicher Verträge (Kunden, Lieferanten, Miete, Lizenzen) mit Kontrollwechselklauseln und Zustimmungen', '{"default":"Recht / Vertrieb","owner":"Sie oder Ihr Anwalt","family":"Vertrieb / Ihr Anwalt"}'::jsonb, false),
  ('Q35', 'catalogue-2026.11-v2.0', 'T3', 2, 'CORE', 'Streitigkeiten', 'Haben Sie einen vollständigen Überblick über laufende oder drohende Streitigkeiten, z. B. mit Kunden, Mitarbeitenden oder Behörden?', 7, 'K', '["Nein, dazu gibt es keinen Überblick.","Bekannte Fälle sind erfasst, aber nicht bewertet.","Ja, es gibt keine, oder alle sind bewertet und finanziell berücksichtigt."]'::jsonb, 'Liste laufender und drohender Streitigkeiten mit Einschätzung bzw. Erklärung, dass keine bestehen', '{"default":"Recht","owner":"Sie oder Ihr Anwalt","family":"Recht / Ihr Anwalt"}'::jsonb, false),
  ('Q36', 'catalogue-2026.11-v2.0', 'T3', 2, 'CORE', 'Datenschutz', 'Hat jemand, z. B. Ihr Datenschutzbeauftragter, geprüft, ob Ihr Unternehmen die Datenschutzregeln einhält?', 7, 'K', '["Nein, das hat niemand geprüft.","Ja, aber offene Punkte sind noch nicht behoben.","Ja, geprüft; offene Punkte sind behoben oder haben Verantwortliche und Termine."]'::jsonb, 'Bericht des Datenschutzbeauftragten mit Maßnahmenliste und Verantwortlichen', '{"default":"Datenschutz / Recht","owner":"Ihr Datenschutzbeauftragter","family":"Datenschutz / Ihr Anwalt"}'::jsonb, false),
  ('Q37', 'catalogue-2026.11-v2.0', 'T3', 3, 'REGULATED', 'Genehmigungen nach dem Verkauf', 'Haben Sie geprüft, ob Ihre Genehmigungen und Zulassungen nach einem Verkauf weiter gelten?', 7, 'K', '["Nein, das haben wir nicht geprüft.","Die Anforderungen kennen wir, die Schritte sind nicht geplant.","Ja, geprüft; nötige Anträge, Anzeigen und Zeitplan sind festgehalten."]'::jsonb, 'Liste der Genehmigungen mit Folgen eines Eigentümerwechsels, nötigen Anträgen oder Anzeigen und Zeitplan', '{"default":"Regulatorik / Recht","owner":"Sie oder Ihr Anwalt","family":"Regulatorik / Ihr Anwalt"}'::jsonb, false),
  ('Q38', 'catalogue-2026.11-v2.0', 'T3', 3, 'INVESTOR_RIGHTS', 'Erlösverteilung unter den Gesellschaftern', 'Können Sie zeigen, wie der Verkaufserlös bei verschiedenen Preisen unter den Gesellschaftern verteilt wird, einschließlich Vorzugsrechten und Wandeldarlehen?', 7, 'K', '["Nein, Vorzugs- und Wandelrechte sind nicht zusammengestellt.","Die Rechte sind erfasst, eine Berechnung je Preis fehlt.","Ja, für mehrere Preise durchgerechnet, oder es gibt keine Vorzugs- oder Wandelrechte."]'::jsonb, 'Erlösverteilungsrechnung für mehrere Preisszenarien einschließlich Wandlung, auf Basis der Gesellschaftervereinbarung und der Wandelverträge', '{"default":"Recht / CFO","owner":"Recht / CFO","family":null}'::jsonb, false),
  ('Q39', 'catalogue-2026.11-v2.0', 'T3', 2, 'EMPLOYEE_EQUITY', 'Beteiligungen von Mitarbeitenden', 'Ist geregelt, was bei einem Verkauf mit den Beteiligungen von Mitarbeitenden und Management passiert (z. B. Anteile, Optionen oder eine virtuelle Beteiligung)?', 7, 'G', '["Nein, das ist nicht geregelt.","Die Vereinbarungen sind erfasst, die Behandlung beim Verkauf ist offen.","Ja, für jede Vereinbarung ist festgehalten, was beim Verkauf passiert."]'::jsonb, 'Übersicht der Vereinbarungen mit Berechtigten, Bedingungen, Behandlung beim Verkauf und Kosten', '{"default":"Recht / Personal / Steuern","owner":"Sie oder Ihr Anwalt","family":"Sie / Ihr Anwalt"}'::jsonb, false),
  ('Q41', 'catalogue-2026.11-v2.0', 'T4', 2, 'CORE', 'Team für den Verkauf', 'Haben Sie schon ein Team für den Verkauf, z. B. mit einem M&A-Berater?', 8, '-', '["Nein, noch nicht.","Teilweise; ein internes Team oder ein erfahrener Berater fehlt noch.","Ja, Team und Berater stehen, Rollen und Zeitplan sind vereinbart."]'::jsonb, 'Projektplan mit Team, Berater, Rollen und Zeitplan', '{"default":"Transaktionsleitung","owner":"Sie","family":"Sie"}'::jsonb, false),
  ('Q48', 'catalogue-2026.11-v2.0', 'T4', 3, 'SEPARATION', 'Übergangsvereinbarungen', 'Sind Übergangsvereinbarungen vorbereitet, mit denen der Konzern oder das übrige Unternehmen Leistungen noch eine Zeit lang erbringt?', 8, 'K', '["Nein, solche Vereinbarungen sind nicht geplant.","Teilweise; Leistungen, Preise oder Laufzeiten sind offen.","Ja, Leistungen, Preise, Laufzeiten und Ausstiegspläne sind vorbereitet."]'::jsonb, 'Entwürfe der Übergangsvereinbarungen mit Leistungsverzeichnis, Preisen, Laufzeit und Ausstiegsplan', '{"default":"Separierungsleitung / Recht","owner":"Sie oder Ihr Anwalt","family":"Geschäftsführung / Ihr Anwalt"}'::jsonb, true);

insert into public.profile_weights (catalogue_version, profile, domain, weight)
values
  ('catalogue-2026.11-v2.0', 'OWNER', 'S1', 35),
  ('catalogue-2026.11-v2.0', 'OWNER', 'S2', 35),
  ('catalogue-2026.11-v2.0', 'OWNER', 'S3', 30),
  ('catalogue-2026.11-v2.0', 'OWNER', 'O1', 25),
  ('catalogue-2026.11-v2.0', 'OWNER', 'O2', 20),
  ('catalogue-2026.11-v2.0', 'OWNER', 'O3', 25),
  ('catalogue-2026.11-v2.0', 'OWNER', 'O4', 15),
  ('catalogue-2026.11-v2.0', 'OWNER', 'O5', 15),
  ('catalogue-2026.11-v2.0', 'OWNER', 'T1', 25),
  ('catalogue-2026.11-v2.0', 'OWNER', 'T2', 25),
  ('catalogue-2026.11-v2.0', 'OWNER', 'T3', 25),
  ('catalogue-2026.11-v2.0', 'OWNER', 'T4', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'S1', 30),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'S2', 35),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'S3', 35),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'O1', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'O2', 15),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'O3', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'O4', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'O5', 10),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'T1', 20),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'T2', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'T3', 25),
  ('catalogue-2026.11-v2.0', 'CORPORATE', 'T4', 30),
  ('catalogue-2026.11-v2.0', 'PE', 'S1', 30),
  ('catalogue-2026.11-v2.0', 'PE', 'S2', 30),
  ('catalogue-2026.11-v2.0', 'PE', 'S3', 40),
  ('catalogue-2026.11-v2.0', 'PE', 'O1', 30),
  ('catalogue-2026.11-v2.0', 'PE', 'O2', 20),
  ('catalogue-2026.11-v2.0', 'PE', 'O3', 20),
  ('catalogue-2026.11-v2.0', 'PE', 'O4', 15),
  ('catalogue-2026.11-v2.0', 'PE', 'O5', 15),
  ('catalogue-2026.11-v2.0', 'PE', 'T1', 25),
  ('catalogue-2026.11-v2.0', 'PE', 'T2', 20),
  ('catalogue-2026.11-v2.0', 'PE', 'T3', 25),
  ('catalogue-2026.11-v2.0', 'PE', 'T4', 30),
  ('catalogue-2026.11-v2.0', 'VC', 'S1', 25),
  ('catalogue-2026.11-v2.0', 'VC', 'S2', 40),
  ('catalogue-2026.11-v2.0', 'VC', 'S3', 35),
  ('catalogue-2026.11-v2.0', 'VC', 'O1', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'O2', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'O3', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'O4', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'O5', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'T1', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'T2', 20),
  ('catalogue-2026.11-v2.0', 'VC', 'T3', 35),
  ('catalogue-2026.11-v2.0', 'VC', 'T4', 25);

commit;
