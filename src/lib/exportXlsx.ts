// Branded Excel export of the result (atares Golden Rules: Aptos, navy, one
// thin line under each row, date-prefixed file name). Four sheets: overview,
// action plan, documents and answers. `buildActionPlanWorkbook` returns the
// bytes and runs in node, so it is tested without a browser.

import { PROFILE_NAMES, QUESTION_BY_ID } from '../model/catalogue';
import type { Result } from '../model/plan';
import { questionText, STATUS_LABEL } from '../model/routing';
import type { AnswerMap, AssessmentContext } from '../model/types';
import { fileDate, formatDate } from './i18n';
import { deepList } from './journey';

const NAVY = 'FF002336';
const NAVY_2 = 'FF003E5F';
const GREY_1 = 'FFF2F3F4';
const GREY_2 = 'FFCBD2D6';
const GREY_4 = 'FF324E5E';
const WHITE = 'FFFFFFFF';

export interface TaskFollowUp { status: string; dueDate: string | null }

export interface ExportInput {
  result: Result;
  ctx: AssessmentContext;
  answers: AnswerMap;
  tasks: Record<string, TaskFollowUp>;
  chips: string[];
  /** Logo as a data URL. Omitted: fetched in the browser. null: no logo (tests). */
  logo?: string | null;
  now?: Date;
}

const STATUS: Record<string, string> = { open: 'Offen', in_progress: 'In Arbeit', done: 'Erledigt' };

async function asAptosWorkbook(buf: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const styles = zip.file('xl/styles.xml');
    if (styles) {
      const xml = await styles.async('string');
      zip.file('xl/styles.xml', xml.replace(/(<fonts[^>]*>\s*<font>[\s\S]*?<name val=")[^"]+(")/, '$1Aptos$2'));
    }
    const theme = zip.file('xl/theme/theme1.xml');
    if (theme) {
      const xml = await theme.async('string');
      zip.file('xl/theme/theme1.xml', xml.replace(/(<a:(?:major|minor)Font>\s*<a:latin typeface=")[^"]+(")/g, '$1Aptos$2'));
    }
    return await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  } catch {
    return buf;
  }
}

async function logoDataUrl(): Promise<string | null> {
  if (typeof fetch !== 'function' || typeof FileReader === 'undefined') return null;
  try {
    const blob = await (await fetch('/media/atares-logo-full-navy.png')).blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildActionPlanWorkbook({ result: r, ctx, answers, tasks, chips, logo: logoIn, now = new Date() }: ExportInput): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ExitIQ by atares';
  wb.created = now;
  const logo = logoIn === undefined ? await logoDataUrl() : logoIn;
  const logoId = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;
  type Ws = ReturnType<typeof wb.addWorksheet>;
  const border = { bottom: { style: 'thin' as const, color: { argb: GREY_2 } } };
  const sheet = (name: string, widths: number[]) => {
    const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = widths.map((width) => ({ width }));
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 30;
    if (logoId != null) ws.addImage(logoId, { tl: { col: 0.1, row: 0.15 }, ext: { width: 152, height: 56 } });
    const title = ws.getCell(1, 3);
    title.value = 'ExitIQ Maßnahmenplan';
    title.font = { name: 'Aptos', size: 18, bold: true, color: { argb: NAVY } };
    const sub = ws.getCell(2, 3);
    sub.value = `Erstellt am ${formatDate(now)}`;
    sub.font = { name: 'Aptos', size: 11, color: { argb: GREY_4 } };
    for (let c = 1; c <= widths.length; c++) ws.getCell(3, c).border = { bottom: { style: 'thin', color: { argb: NAVY } } };
    ws.getRow(3).height = 6;
    return ws;
  };
  const header = (ws: Ws, row: number, labels: string[]) => {
    labels.forEach((l, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = l;
      c.font = { name: 'Aptos', size: 11, bold: true, color: { argb: WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_2 } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    ws.getRow(row).height = 22;
  };
  const cell = (ws: Ws, row: number, col: number, value: string | number | null, bold = false, fill?: string) => {
    const c = ws.getCell(row, col);
    c.value = value;
    c.font = { name: 'Aptos', size: 11, bold, color: { argb: NAVY } };
    c.alignment = { vertical: 'top', wrapText: true };
    c.border = border;
    if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  };

  // ── Übersicht ──────────────────────────────────────────────────────────────
  const ov = sheet('Übersicht', [34, 16, 60, 20]);
  let row = 5;
  cell(ov, row, 1, 'Angaben', true, GREY_1); ov.mergeCells(row, 2, row, 4); cell(ov, row, 2, chips.join(' · ')); row++;
  cell(ov, row, 1, 'Perspektive', true, GREY_1); ov.mergeCells(row, 2, row, 4); cell(ov, row, 2, PROFILE_NAMES[r.score.profile]); row += 2;
  header(ov, row, ['Wert', 'Ergebnis', 'Status', 'Abdeckung']); row++;
  for (const d of r.dimensions) {
    cell(ov, row, 1, d.name, true);
    cell(ov, row, 2, d.displayIndex);
    cell(ov, row, 3, d.status === 'complete' ? 'Vollständig' : d.status === 'provisional' ? `Vorläufig, Spanne ${Math.round(d.lower)} bis ${Math.round(d.upper)}` : 'Noch kein Wert');
    cell(ov, row, 4, `${Math.round(d.coverage * 100)} %`);
    row++;
  }

  // ── Maßnahmenplan ──────────────────────────────────────────────────────────
  const plan = sheet('Maßnahmenplan', [6, 44, 50, 50, 20, 14, 14]);
  header(plan, 5, ['Nr.', 'Aufgabe', 'Warum', 'Nachweis', 'Zeitpunkt (Vorschlag)', 'Kapitel', 'Status']);
  r.tasks.forEach((t, i) => {
    const rr = 6 + i;
    cell(plan, rr, 1, i + 1);
    cell(plan, rr, 2, t.title, i < r.topSteps.length);
    cell(plan, rr, 3, t.reason);
    cell(plan, rr, 4, t.evidence);
    cell(plan, rr, 5, t.suggestedTiming);
    cell(plan, rr, 6, t.chapter != null ? `${t.chapter + 1}` : '–');
    cell(plan, rr, 7, STATUS[tasks[t.key]?.status ?? 'open']);
  });
  plan.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + r.tasks.length, column: 7 } };

  // ── Unterlagen ─────────────────────────────────────────────────────────────
  const docs = sheet('Unterlagen', [70, 30, 14]);
  header(docs, 5, ['Unterlage', 'Wartet auf', 'Status']);
  r.checklist.forEach((c, i) => {
    cell(docs, 6 + i, 1, c.title);
    cell(docs, 6 + i, 2, c.waitingFor.map((id) => QUESTION_BY_ID[id].name).join(', ') || null);
    cell(docs, 6 + i, 3, STATUS[tasks[c.key]?.status ?? 'open']);
  });

  // ── Antworten ──────────────────────────────────────────────────────────────
  const ans = sheet('Antworten', [10, 30, 60, 50]);
  header(ans, 5, ['Kapitel', 'Thema', 'Frage', 'Antwort']);
  deepList(ctx, answers).forEach((x, i) => {
    const a = answers[x.q.id];
    const text = questionText(x.q, ctx, answers);
    const answer = !a ? 'Nicht beantwortet'
      : a.status === 'substantive' && a.points != null ? text.anchors[a.points / 50]
      : a.status === 'not_applicable' ? 'Trifft auf uns nicht zu'
      : STATUS_LABEL[a.status as 'clarify' | 'lookup'];
    cell(ans, 6 + i, 1, `${x.chapter + 1}`);
    cell(ans, 6 + i, 2, `${x.q.name}`);
    cell(ans, 6 + i, 3, text.question);
    cell(ans, 6 + i, 4, answer);
  });

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return asAptosWorkbook(buf);
}

export async function exportActionPlanXlsx(input: ExportInput): Promise<void> {
  const bytes = await buildActionPlanWorkbook(input);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileDate()}_ExitIQ_Maßnahmenplan.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
