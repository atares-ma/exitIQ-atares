import { interimPosition, progressDone, progressTotal, totalLabel } from '../../lib/journey';
import { useAssessment } from '../../lib/store';

/**
 * One counter from the first click to the result (R2-01): "Frage 16 von 42",
 * a thin bar (answered / total) and a mark where the interim result comes.
 */
export function ProgressCounter({ label, done: doneIn }: { label: string; done?: number }) {
  const s = useAssessment();
  const total = progressTotal(s.ctx, s.answers);
  const done = Math.min(doneIn ?? progressDone(s.ctx, s.answers), total.total);
  const interim = total.approx ? null : interimPosition(s.ctx, s.answers);
  const text = `${label} von ${totalLabel(total)}`;
  return (
    <div className="progress-counter">
      <span aria-live="polite">{text}</span>
      <div className="progress-track" role="img" aria-label={`${done} von ${totalLabel(total)} Angaben erledigt`}>
        <i style={{ width: `${(done / total.total) * 100}%` }} />
        {interim != null && interim < total.total && (
          <span className="progress-mark" style={{ left: `${(interim / total.total) * 100}%` }}>
            <span className="progress-mark-label">Zwischenergebnis</span>
          </span>
        )}
      </div>
    </div>
  );
}
