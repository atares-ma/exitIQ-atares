import { dismissNotice, useAssessment } from '../../lib/store';

/** One-off notice, e.g. after "Trifft auf uns nicht zu" deselected a specialist topic (ST3). */
export function Notice() {
  const { notice } = useAssessment();
  if (!notice) return null;
  return (
    <div className="notice" role="status">
      <span>{notice}</span>
      <button type="button" className="link-inline" onClick={dismissNotice}>Ausblenden</button>
    </div>
  );
}
