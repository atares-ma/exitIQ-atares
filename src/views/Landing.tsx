import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { Bar, Brand, CheckboxGroup, RadioGroup } from '../components/ui';
import { contextComplete, setupComplete } from '../lib/journey';
import { imprintUrl, privacyUrl } from '../lib/links';
import { markLandingEntry } from '../lib/remote';
import { go, hasProgress, setContext, useAssessment } from '../lib/store';
import { INTENT_OPTIONS, LIQUIDITY_OPTIONS, MANAGEMENT_OPTIONS, OWNERSHIP_OPTIONS } from '../model/options';
import { crisisReason, intentLabel, onlyCorporate, toggleIntent } from '../model/routing';
import type { OwnershipTag } from '../model/types';
import { exampleReport } from './landing-example';

const STAGES = [
  { title: 'Kontext', body: 'Vier kurze Fragen zu Eigentümern, Führung, Vorhaben und Zahlungsfähigkeit. Danach erhalten Sie nur Fragen, die zu Ihrer Situation passen.', outcome: 'Nur passende Fragen', detail: 'Inhaber, Familien, Konzerne, Private Equity und Venture Capital, auch in Kombination.' },
  { title: 'Einrichtung', body: 'Zeitplan, Spezialthemen wie Kredite oder frühere Zukäufe und wer verkauft. Für eine private Nachfolge sind das drei Angaben.', outcome: 'Ihr Fragenumfang', detail: 'Die Übersicht zeigt, wie viele Fragen für Sie gelten und welche durch Ihre Angaben schon beantwortet sind.' },
  { title: 'Kapitel 1–4', body: 'Ziele und Entscheidung, Wirtschaftlichkeit, Umsatz und Betrieb, Personen und Kontinuität. Eine Frage pro Seite mit drei klaren Aussagen.', outcome: 'Zwischenergebnis', detail: 'Nach Kapitel 4 stehen zwei von drei Werten fest: Strategische Klarheit und Operative Übertragbarkeit.' },
  { title: 'Kapitel 5–8', body: 'Finanzen, Steuern, Recht und Transaktionsdurchführung. Wo Sie etwas erst klären oder nachsehen müssen, wird es zur Aufgabe statt zur Lücke.', outcome: 'Dritter Wert', detail: 'Die Transaktionsvorbereitung zeigt, wie weit Zahlen, Steuern und Verträge für einen Käufer bereit sind.' },
  { title: 'Ergebnis', body: 'Drei Werte mit Status und Spanne, darunter Ihre fünf wichtigsten Schritte, weitere Aufgaben nach Kapitel und eine Checkliste der Unterlagen.', outcome: 'Konkrete nächste Schritte', detail: 'Jede Aufgabe nennt Ansprechperson, Zeitpunkt und den passenden Nachweis. Als PDF oder Excel mitnehmen.' },
];

const DIMS = [
  { name: 'Strategische Klarheit', body: 'Ziele, Zeitplan, Einigkeit der Entscheider, nötige Zustimmungen und Ihre Rolle nach dem Verkauf.' },
  { name: 'Operative Übertragbarkeit', body: 'Ob Gewinn, Kunden, Lieferanten, Abläufe, Mitarbeitende und IT ohne Sie oder die heutige Führung funktionieren.' },
  { name: 'Transaktionsvorbereitung', body: 'Zahlen der letzten Jahre, steuerliche Vorbereitung, Nachweis der Anteile, wichtige Verträge und das Team für den Verkauf.' },
];

const PROFILES = [
  { label: 'Inhaber oder Familie', focus: 'Ihre Ziele, Ihre Rolle nach dem Verkauf, Vertretung bei Entscheidungen, Nachweis der Anteile und die steuerlich beste Form des Verkaufs.', avoid: 'Ihre persönliche Rolle automatisch als Hindernis werten.' },
  { label: 'Konzern', focus: 'Abgrenzung des Verkaufsumfangs, eigene Zahlen des verkauften Teils, gemeinsam genutzte Leistungen, Trennung der IT und Übergangsvereinbarungen.', avoid: 'Annehmen, dass eine eigene Gesellschaft schon eigenständig arbeitet.' },
  { label: 'Private Equity', focus: 'Belegte Wertsteigerung seit dem Einstieg, Zustimmung der Banken, offene Punkte aus Zukäufen, Beteiligung des Managements und Erlösverteilung.', avoid: 'Die Fondslaufzeit als Beleg für Verkaufsbereitschaft werten.' },
  { label: 'Venture Capital', focus: 'Weg zur Profitabilität, voll verwässerte Beteiligungsübersicht, Vorzugs- und Wandelrechte und die Trennung von Wachstumskapital und Verkaufserlösen.', avoid: 'Bewusste Investitionen in Wachstum abstrafen, nur weil das Ergebnis negativ ist.' },
];

export default function Landing() {
  const state = useAssessment();
  const resumable = hasProgress(state) && contextComplete(state.ctx);

  useEffect(() => {
    document.title = 'ExitIQ von atares M&A';
  }, []);

  const start = () => navigate('/assessment');
  const startCta = () => {
    markLandingEntry();
    start();
  };

  return (
    <div style={{ background: 'var(--white)' }}>
      <header className="site-header">
        <div className="wrap" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Brand />
          <nav aria-label="Abschnitte">
            <a href="#how">So funktioniert es</a>
            <a href="#report">Ihr Ergebnis</a>
            <a href="#ownership">Eigentümerstruktur</a>
            <a href="#about">Über atares</a>
          </nav>
          {resumable && <button type="button" className="btn btn-ghost btn-sm" onClick={start}>Einschätzung fortsetzen</button>}
        </div>
      </header>

      <main id="main">
        <Hero onStart={startCta} />
        <HowItWorks />
        <ReportPreview />
        <Ownership />

        <section id="about" aria-labelledby="about-title">
          <div className="wrap section two-col" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <img src="/media/atares-logo-navy.png" alt="atares, merging visions" style={{ height: 56, width: 'auto', alignSelf: 'flex-start' }} />
              <h2 className="h2" id="about-title">Entwickelt von M&amp;A-Beratern, die täglich Verkäufe vorbereiten.</h2>
              <p className="lead muted" style={{ fontSize: 16 }}>atares ist die digitale M&amp;A-Boutique für technologiegetriebene Mittelständler mit Sitz in München. In mehr als 20 Jahren hat das Team über 200 Technologietransaktionen begleitet.</p>
              <p className="lead muted" style={{ fontSize: 16 }}>ExitIQ bringt die Fragen, die wir in der Vorbereitung stellen, in eine Form, die Sie selbst durcharbeiten können. Der Maßnahmenplan gehört Ihnen, ob Sie mit uns sprechen oder nicht.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['200+', 'begleitete Technologietransaktionen'], ['20+', 'Jahre M&A-Erfahrung']].map(([n, l]) => (
                <div key={n} style={{ background: 'var(--navy-2)', color: 'var(--white)', borderRadius: 18, padding: 22 }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--lime)' }}>{n}</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.84)' }}>{l}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', background: 'var(--grey-1)', border: '1px solid var(--grey-2)', borderRadius: 18, padding: 22 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Netzwerk aus Käufern und Investoren</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--grey-4)' }}>Persönliche Beziehungen zu strategischen Käufern, Private-Equity-Investoren und M&amp;A-Beratern in Europa, Amerika und Asien.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-dark">
          <div className="wrap section" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h2 className="h2" style={{ color: 'var(--lime)', maxWidth: 800 }}>In etwa 15 Minuten wissen Sie, wo Sie stehen.</h2>
            <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', maxWidth: 620, fontSize: 16 }}>Kostenlos und vertraulich. Ein Gespräch mit atares ist eine freiwillige, getrennte Entscheidung.</p>
            <div><button type="button" className="btn btn-lime btn-lg" onClick={startCta}>Einschätzung starten <span aria-hidden="true">→</span></button></div>
            <footer className="landing-foot">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
                <img src="/media/atares-logo-white.png" alt="atares" style={{ height: 26, width: 'auto', alignSelf: 'flex-start' }} />
                <p className="landing-disclaimer">
                  ExitIQ ist eine strukturierte Selbsteinschätzung. Sie ersetzt keine rechtliche, steuerliche oder finanzielle Beratung, und die Ergebnisse sind keine Unternehmensbewertung.
                  Kostenlos und unverbindlich. Ihre Angaben werden laufend gespeichert, Sie können jederzeit pausieren. Jede Aufgabe nennt eine Ansprechperson. Ihre Angaben behandeln wir vertraulich und geben sie nur mit Ihrer Zustimmung weiter.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                <a href={imprintUrl()}>Impressum</a>
                <a href={privacyUrl()}>Datenschutz</a>
                <a href="https://atares.team">atares.team</a>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * The hero shows the real context page, one question at a time (D1): the
 * answers are saved and "Weiter" leads straight into the questionnaire.
 */
function Hero({ onStart }: { onStart: () => void }) {
  const { ctx } = useAssessment();
  const [step, setStep] = useState(0);
  const [video, setVideo] = useState(true);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setVideo(false);
  }, []);
  const answered = [ctx.ownershipTags.length > 0, !!ctx.managementModel, ctx.intents.length > 0, !!ctx.liquidity][step];
  const toggle = (v: OwnershipTag) => {
    const ownershipTags = ctx.ownershipTags.includes(v) ? ctx.ownershipTags.filter((x) => x !== v) : [...ctx.ownershipTags, v];
    setContext({ ownershipTags, ...(onlyCorporate({ ...ctx, ownershipTags }) && ctx.managementModel === 'owner_led' ? { managementModel: null } : {}), profileOverride: null });
  };
  const titles = ['Wem gehört das Unternehmen heute?', 'Wer führt das Tagesgeschäft?', 'Was haben Sie mit dem Unternehmen vor?', 'Kann Ihr Unternehmen alle Zahlungen der nächsten sechs Monate sicher leisten?'];
  const finish = () => {
    markLandingEntry();
    navigate('/assessment');
    go(crisisReason(ctx) ? 'crisis' : setupComplete(ctx) ? 'overview' : 'setup1');
  };

  return (
    <section id="top" className="hero">
      {video && <video src="/media/hero-loop.mp4" poster="/media/bg-dark.jpg" autoPlay muted loop playsInline aria-hidden="true" />}
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="kicker">Kostenlose Exit-Readiness-Selbsteinschätzung</div>
          <h1>Sehen Sie Ihr Unternehmen mit den Augen eines Käufers.</h1>
          <p className="lead hero-lead">Der ExitIQ zeigt Ihnen, ob Ihr Unternehmen strategisch und operativ für einen Exit bereit ist.</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-lime btn-lg" onClick={onStart}>Einschätzung starten <span aria-hidden="true">→</span></button>
            <a href="#how" className="btn btn-ghost btn-lg">So funktioniert es</a>
          </div>
          <p className="hero-meta">Dauer etwa 15 Minuten. Sie können jederzeit pausieren.</p>
        </div>

        <div className="glass hero-card" aria-label="Die ersten vier Fragen">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="pill hero-card-pill">Kontext</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.74)' }} aria-live="polite">Frage {step + 1} von 4</span>
          </div>
          <div className="progress-dots" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <span key={i} className={i < step ? 'done' : i === step ? 'current' : ''} />)}
          </div>
          <div key={step} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="hero-q">{titles[step]}</div>
            {step === 0 && <CheckboxGroup label={titles[0]} layout="list" choices={OWNERSHIP_OPTIONS} values={ctx.ownershipTags} onToggle={toggle} />}
            {step === 1 && (
              <RadioGroup label={titles[1]} layout="list" value={ctx.managementModel} onChange={(managementModel) => setContext({ managementModel })}
                choices={MANAGEMENT_OPTIONS.map((o) => ({ ...o, disabled: o.value === 'owner_led' && onlyCorporate(ctx) }))} />
            )}
            {step === 2 && (
              <CheckboxGroup label={titles[2]} layout="list" values={ctx.intents} onToggle={(v) => setContext({ intents: toggleIntent(ctx.intents, v) })}
                choices={INTENT_OPTIONS.map((o) => ({ value: o.value, label: intentLabel(ctx, o.value) }))} />
            )}
            {step === 3 && <RadioGroup label={titles[3]} layout="list" value={ctx.liquidity} choices={LIQUIDITY_OPTIONS} onChange={(liquidity) => setContext({ liquidity })} />}
            {(step === 0 || step === 2) && <span className="field-note">Mehrfachauswahl möglich</span>}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Zurück</button>
            <button type="button" className="btn btn-lime btn-sm" disabled={!answered}
              onClick={() => (step < 3 ? setStep((s) => s + 1) : contextComplete(ctx) && finish())}>
              {step < 3 ? 'Weiter' : 'Weiter zur Einrichtung'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const [i, setI] = useState(0);
  const st = STAGES[i];
  return (
    <section id="how" aria-labelledby="how-title">
      <div className="wrap section" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="kicker dark">So funktioniert es</div>
        <h2 className="h2" id="how-title" style={{ maxWidth: 820 }}>Fünf Schritte, ein Zwischenergebnis nach der Hälfte.</h2>
        <div role="tablist" aria-label="Ablauf" className="grid-auto" style={{ ['--min' as string]: '170px', gap: 10 }}>
          {STAGES.map((s, j) => (
            <button key={s.title} type="button" role="tab" aria-selected={i === j} aria-controls="stage-panel" className="stage-tab" onClick={() => setI(j)}>
              <span className="n">0{j + 1}</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</span>
            </button>
          ))}
        </div>
        <div id="stage-panel" role="tabpanel" key={i} className="fade-up two-col stage-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 className="h3">{st.title}</h3>
            <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--grey-4)' }}>{st.body}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="kicker dark" style={{ fontSize: 13 }}>Was Sie erhalten</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{st.outcome}</div>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--grey-4)', fontSize: 15 }}>{st.detail}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const EXAMPLE = exampleReport();

function ReportPreview() {
  const [i, setI] = useState(0);
  const ex = EXAMPLE[i].result;
  const label = (j: number) => {
    const d = EXAMPLE[j].result;
    return {
      status: d.status === 'complete' ? 'Vollständig' : d.status === 'provisional' ? 'vorläufig' : 'Noch kein Wert',
      index: d.displayIndex == null ? '–' : String(d.displayIndex),
      range: d.status === 'provisional' ? `Spanne ${Math.round(d.lower)} bis ${Math.round(d.upper)}` : d.status === 'complete' ? 'Alle Fragen beantwortet' : `${d.openIds.length} Antworten fehlen noch`,
    };
  };
  return (
    <section id="report" className="section-dark" aria-labelledby="report-title">
      <div className="wrap section" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="kicker">Ihr Ergebnis</div>
        <h2 className="h2" id="report-title" style={{ maxWidth: 760 }}>Drei Werte statt einer Gesamtnote.</h2>
        <p className="lead" style={{ maxWidth: 780, fontSize: 16, color: 'rgba(255,255,255,0.86)' }}>Jeder Wert reicht von 0 bis 100. Offene Antworten zählen nicht gegen Sie: Der Wert wird dann als vorläufig mit Spanne gezeigt, und die offene Frage landet als Aufgabe in Ihrem Plan.</p>
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="tablist" aria-label="Werte">
            {DIMS.map((d, j) => {
              const m = label(j);
              return (
                <button key={d.name} type="button" role="tab" aria-selected={i === j} onClick={() => setI(j)} className={`dim-tab${i === j ? ' on' : ''}`}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 17 }}>{d.name}</span>
                    <span className="pill dim-tab-pill">{m.status}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 32, fontWeight: 800 }}>{m.index}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{m.range}</span>
                  </span>
                </button>
              );
            })}
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Beispiel, berechnet mit dem aktuellen Modell: inhabergeführter IT-Dienstleister, ganzer Verkauf, Ansprache der Käufer in weniger als sechs Monaten.</p>
          </div>
          <div key={i} className="fade-up card-light" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} role="tabpanel">
            <div className="kicker dark" style={{ fontSize: 13 }}>Was {DIMS[i].name} umfasst</div>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 16 }}>{DIMS[i].body}</p>
            {ex.domains.map((m) => {
              const v = m.index == null ? null : Math.round(m.index);
              const lc = m.localCoverage;
              const l = v == null ? 'offen' : lc < 0.999 ? `${v} · ${Math.round(lc * 100)} % beantwortet` : String(v);
              return (
                <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}><b>{m.name}</b><span style={{ whiteSpace: 'nowrap' }}>{l}</span></div>
                  <Bar value={v == null ? 0 : v * lc} open={(1 - lc) * 100} label={`${m.name}: ${l}`} />
                </div>
              );
            })}
            {EXAMPLE[i].risk && (
              <div className="example-risk">
                <span className="pill crit-pill">Kritisch</span>
                <span>{EXAMPLE[i].risk!.text}</span>
              </div>
            )}
          </div>
        </div>
        <div className="two-col" style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 28, marginTop: 12 }}>
          <b>Was ExitIQ bewusst nicht zeigt</b>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'rgba(255,255,255,0.84)', fontSize: 15 }}>Keinen Gesamtwert, keine Unternehmensbewertung, keine Verkaufswahrscheinlichkeit und keinen Multiple. Die Werte beschreiben die Vorbereitung, nicht den Preis.</p>
        </div>
      </div>
    </section>
  );
}

function Ownership() {
  const [i, setI] = useState(0);
  const p = PROFILES[i];
  return (
    <section id="ownership" aria-labelledby="own-title">
      <div className="wrap section" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div className="kicker dark">Eigentümerstruktur</div>
        <h2 className="h2" id="own-title" style={{ maxWidth: 720 }}>Die Fragen folgen Ihrer Situation.</h2>
        <p className="lead muted" style={{ maxWidth: 780, fontSize: 16 }}>Eine Familiennachfolge wirft andere Fragen auf als ein PE-Exit oder der Verkauf eines Geschäftsbereichs. ExitIQ wählt Fragen, Wortlaute und Ansprechpersonen passend zu Ihren Angaben.</p>
        <div role="tablist" aria-label="Eigentümerstruktur" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PROFILES.map((x, j) => <button key={x.label} type="button" role="tab" aria-selected={i === j} className="profile-tab" onClick={() => setI(j)}>{x.label}</button>)}
        </div>
        <div key={i} className="fade-up grid-auto" role="tabpanel" style={{ ['--min' as string]: '260px' }}>
          <div style={{ background: 'var(--navy-2)', color: 'var(--white)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="kicker" style={{ fontSize: 13 }}>Worauf wir achten</div>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 16 }}>{p.focus}</p>
          </div>
          <div style={{ background: 'var(--grey-1)', border: '1px solid var(--grey-2)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="kicker dark" style={{ fontSize: 13 }}>Was wir nicht tun</div>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 16 }}>{p.avoid}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
