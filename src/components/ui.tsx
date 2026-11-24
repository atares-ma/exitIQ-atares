import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { withTerms } from '../model/glossary';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <a href={href} className="brand" aria-label="ExitIQ von atares, zur Startseite">
      <img src="/media/atares-logo-white.png" alt="atares" />
      <span className="divider" aria-hidden="true" />
      <span className="name">Exit<b>IQ</b></span>
    </a>
  );
}

/** Arrow-key navigation inside a radio group, as native radios would do. */
function arrowNav(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
  if (!keys.includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const n = items[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
  n.focus();
  n.click();
}

export interface Choice<T extends string | number> { value: T; label: ReactNode; sub?: ReactNode; tag?: string; disabled?: boolean; /** Visually set apart (status line, "Trifft auf uns nicht zu") but in the same list. */ status?: boolean }

export function RadioGroup<T extends string | number>({ label, choices, value, onChange, min = '200px', layout = 'grid' }: {
  label: string; choices: Choice<T>[]; value: T | null | undefined; onChange: (v: T) => void; min?: string; layout?: 'grid' | 'list';
}) {
  const hasValue = choices.some((c) => c.value === value);
  return (
    <div role="radiogroup" aria-label={label} className={layout === 'grid' ? 'opt-grid' : 'opt-list'} style={{ ['--min' as string]: min }} onKeyDown={arrowNav}>
      {choices.map((c, i) => {
        const on = c.value === value;
        return (
          <button type="button" key={String(c.value)} role="radio" aria-checked={on} aria-disabled={c.disabled || undefined} tabIndex={on || (!hasValue && i === 0) ? 0 : -1} className={`opt${c.status ? ' opt-status' : ''}`} onClick={() => !c.disabled && onChange(c.value)}>
            <span className="mark" aria-hidden="true" />
            <span>
              {c.label}
              {c.sub && <span className="sub">{c.sub}</span>}
            </span>
            {c.tag && <span className="tag">{c.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CheckboxGroup<T extends string>({ label, choices, values, onToggle, min = '200px', layout = 'grid' }: {
  label: string; choices: Choice<T>[]; values: T[]; onToggle: (v: T) => void; min?: string; layout?: 'grid' | 'list';
}) {
  return (
    <div role="group" aria-label={label} className={layout === 'grid' ? 'opt-grid' : 'opt-list'} style={{ ['--min' as string]: min }}>
      {choices.map((c) => {
        const on = values.includes(c.value);
        return (
          <button type="button" key={c.value} role="checkbox" aria-checked={on} aria-disabled={c.disabled || undefined} className="opt" onClick={() => !c.disabled && onToggle(c.value)}>
            <span className="mark" aria-hidden="true">{on ? '✓' : ''}</span>
            <span>
              {c.label}
              {c.sub && <span className="sub">{c.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ label, choices, value, onChange }: {
  label: string; choices: Choice<T>[]; value: T | null | undefined; onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={arrowNav}>
      {choices.map((c, i) => (
        <button type="button" key={c.value} role="radio" aria-checked={c.value === value} tabIndex={c.value === value || (!value && i === 0) ? 0 : -1} onClick={() => onChange(c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function Field({ label, why, children, id, note }: { label: ReactNode; why?: ReactNode; children: ReactNode; id?: string; note?: string }) {
  return (
    <section className="glass field" aria-labelledby={id}>
      <h2 className="field-label" id={id}>{label}</h2>
      {why && <p className="field-why">{why}</p>}
      {children}
      {note && <p className="field-note">{note}</p>}
    </section>
  );
}

/**
 * A term with a short explanation on hover, focus or tap (ST5). Inside an
 * answer option (`nested`) it is not a control of its own: a tap selects the
 * option as usual and shows the explanation as well.
 */
export function Term({ term, text, nested = false }: { term: string; text: string; nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const control = nested ? {} : {
    role: 'button', tabIndex: 0, 'aria-expanded': open,
    onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((x) => !x); } },
    onFocus: () => setOpen(true), onBlur: () => setOpen(false),
  };
  return (
    <span className="term" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="term-word" aria-describedby={open ? id : undefined} onClick={() => setOpen((x) => !x)} {...control}>{term}</span>
      {open && <span role="tooltip" id={id} className="term-tip">{text}</span>}
      {nested && <span className="sr-only"> ({text})</span>}
    </span>
  );
}

/** Renders a text with its glossary terms explained (ST5). */
export function Glossed({ text, nested = false }: { text: string; nested?: boolean }) {
  return <>{withTerms(text).map((p, i) => (typeof p === 'string' ? p : <Term key={i} term={p.term} text={p.text} nested={nested} />))}</>;
}

export function Bar({ value, color = 'var(--navy-2)', dark = false, open = 0, label }: { value: number; color?: string; dark?: boolean; open?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const o = Math.max(0, Math.min(100 - v, open));
  return (
    <div className={`bar${dark ? ' dark' : ''}`} role="img" aria-label={label}>
      <i style={{ width: `${v}%`, background: color }} />
      {o > 0 && <i className="hatched" style={{ left: `${v}%`, width: `${o}%`, borderRadius: 0 }} />}
    </div>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
