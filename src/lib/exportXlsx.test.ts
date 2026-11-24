import { describe, expect, it } from 'vitest';
import { buildResult } from '../model/plan';
import { blankContext } from './context';
import { buildActionPlanWorkbook } from './exportXlsx';

describe('Excel export', () => {
  it('builds a workbook with plan, documents and answers', async () => {
    const ctx = { ...blankContext(), ownershipTags: ['private_family' as const], managementModel: 'owner_led' as const, intents: ['whole' as const], liquidity: 'no_pressure' as const, horizon: 'm6_18' as const, topicsNone: true, seller: 'individuals_domestic' as const };
    const answers = { Q01: { status: 'substantive' as const, points: 50 as const, answeredAt: '2026-11-24T00:00:00Z' } };
    const bytes = await buildActionPlanWorkbook({ result: buildResult(ctx, answers), ctx, answers, tasks: {}, chips: ['Inhaber oder Familie'], logo: null });
    expect(bytes.byteLength).toBeGreaterThan(5000);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Übersicht', 'Maßnahmenplan', 'Unterlagen', 'Antworten']);
  });
});
