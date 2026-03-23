export const STAGE_ORDER = [
  'INTAKE',
  'WASHING',
  'DRYING',
  'IRONING',
  'PACKING',
  'FINISHED',
  'PICKED_UP',
] as const;

export type Stage = typeof STAGE_ORDER[number];

export const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Penerimaan',
  WASHING: 'Pencucian',
  DRYING: 'Pengeringan',
  IRONING: 'Penyetrikaan',
  PACKING: 'Pengepakan',
  FINISHED: 'Selesai / Siap Diambil',
  PICKED_UP: 'Sudah Diambil',
};

export function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.indexOf(current as Stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function isValidTransition(from: string, to: string): boolean {
  const fromIdx = STAGE_ORDER.indexOf(from as Stage);
  const toIdx = STAGE_ORDER.indexOf(to as Stage);
  return fromIdx !== -1 && toIdx !== -1 && toIdx === fromIdx + 1;
}

export function isValidStage(stage: string): stage is Stage {
  return STAGE_ORDER.includes(stage as Stage);
}
