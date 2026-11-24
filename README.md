# ExitIQ (Neuaufbau November 2026)

ExitIQ ist die Exit-Readiness-Selbsteinschätzung von atares. Diese Version setzt die
**Änderungsliste vom 22.11.2026** (inkl. Freigaben vom 23.11.2026) vollständig um:
`docs/261122_ExitIQ_Aenderungsliste.docx`. Design und Startseite stammen aus der bisherigen
Version (`docs/design/`). Die Seite ist **nur auf Deutsch** (H5: Englisch ausgeblendet bis zur Übersetzung).

React + Vite + TypeScript, Supabase-Projekt `lisurbwzxrvqnvhjmdrn`, Deployment als statische SPA (Vercel).

## Ablauf (Abschnitt 2)

Kontext (K1–K4) → Einrichtung 1 → Einrichtung 2 → Übersicht → Kapitel 1–4 → **Zwischenergebnis** →
Kapitel 5–8 → **Ergebnis**. Einstieg und „Ihr erstes Bild“ entfallen. Krise (K3) oder akute
Zahlungsschwierigkeiten (K4) beenden ExitIQ nach der Kontextseite mit Hinweis (AB5, ER9).

## Wo was steht

| Datei | Inhalt (Abschnitt der Änderungsliste) |
| --- | --- |
| `src/model/catalogue.ts` | Alle Fragen mit neuen Wortlauten, Gewichten, Status-Typ G/F/K/N/–, Ansprechpersonen, Nachweis; Kapitelreihenfolge RO10 (7, 8, 6) |
| `src/model/routing.ts` | K3-Sperren, Perspektive, Module an/aus, Q09/Q26 automatisch, Q21/Q45 und Q53/Q34, Varianten je Bedingung, Status-Zeile, Zusatzzeilen (5, 6) |
| `src/model/scoring.ts` | Abdeckung, 80 %-Schwelle, „vorläufig“ mit Spanne und Grund (9) |
| `src/model/plan.ts` | Regeln R02–R07 und Liquiditätsaufgabe, Aufgaben, fünf wichtigste Schritte, Kapitelgruppen, Unterlagen-Checkliste (10, 11) |
| `src/model/glossary.ts` | Mouseover-Begriffe (ST5, H3) – **Erklärtexte sind Entwürfe**, ohne Code-Änderung pflegbar |
| `src/lib/journey.ts` | Seitenfolge, Sperre „Weiter“, Eingabezählung |
| `src/model/acceptance.test.ts` | Abnahmefälle aus Abschnitt 12 (Eingaben, Fragenzahlen, Wortlaute, Regeln, Carve-out-Rechnung) |

## Supabase einrichten (neues Projekt, einmalig)

1. Dashboard → SQL Editor → Inhalt von `supabase/setup-all-in-one.sql` einfügen und ausführen
   (Schema, RLS, Fragenkatalog; eine Transaktion). Alternativ `npx supabase link --project-ref lisurbwzxrvqnvhjmdrn` und `npx supabase db push`.
2. Authentication → Sign In / Providers → **Allow anonymous sign-ins** einschalten.
3. Authentication → URL Configuration: Site URL = Produktionsdomain, Redirect `https://<domain>/assessment`.
4. Authentication → Email Templates: Betreff mit „ExitIQ“ (D6).
5. Optional CAPTCHA (Turnstile): dann `VITE_TURNSTILE_SITE_KEY` in Vercel setzen.
6. Vercel: `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` (Standardwerte zeigen bereits auf das neue Projekt).

Alte Sitzungen (Einstieg, Q27, Q30, Q40–Q43, Q51, alte Status) werden nicht migriert, sondern starten neu (H6).

## Entwicklung

```bash
npm install
```

```bash
npm run dev
```

`npm test` (Abnahmefälle, Excel-Export) · `npm run typecheck` · `npm run build` · `npm run gen:catalogue-sql` (Seed und `setup-all-in-one.sql` nach Änderungen am Katalog neu erzeugen).

## Offen / Annahmen

- Die Antwortsätze der Testpersonen (Florian, PE, VC, Carve-out) liegen nicht im Repo; geprüft sind Eingabe- und Fragenzahlen, Routing, Wortlaute, Regeln und die Carve-out-Rechnung (T1 = 29). Die Soll-Werte SK/OÜ/TV sollten in den Probeläufen vor dem 10.12. mit den Originalantworten bestätigt werden (H8).
- Reihenfolge der fünf wichtigsten Schritte: kritisch → offener Verkaufsumfang → Zeitpunkt → Wirkung (Gewicht × fehlende Punkte).
- K3-Sperren sind als „ersetzen“ umgesetzt: Wer eine unverträgliche Option wählt, ersetzt die bisherige Auswahl.
- Die frühere KI-Zusammenfassung und die Nachweis-Erfassung je Frage entfallen; der Nachweis steht als eigenes Feld je Aufgabe im Maßnahmenplan (ER10).
