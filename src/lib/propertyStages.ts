/** Suggested construction stages by building / property type (mirrors @nomchael/shared). */

const RESIDENTIAL_STAGES = [
  'Land Clearing',
  'Setting out',
  'Trench excavation',
  'Concrete Bases',
  'Back filling and compacting Concrete Slab',
  'Fixing of bases, columns and ground beams',
  'Shuttering of bases columns and beams',
  'Average level',
  'Window level',
  'Shuttering of ring beam',
  'Steel fixing',
  'Wall plate FF',
  'Concrete roof deck 1',
  'Concrete roof deck 2',
  'Roof deck steel fixing 1',
  'Roof deck steel fixing 2',
  'Parapet and wall coping',
  'Plumbing fix and supply',
];

const WAREHOUSE_STAGES = [
  'Site Clearing',
  'Foundation',
  'Slab',
  'Steel Structure',
  'Roof Structure',
  'Roof Covering',
  'Cladding',
  'Windows & Doors',
  'Loading Bays',
  'Flooring',
  'Plumbing',
  'Electrical',
  'External Works',
  'Painting',
  'Finishing',
];

const COMMERCIAL_STAGES = [
  'Site Clearing',
  'Foundation',
  'Slab',
  'Walls',
  'Steel Structure',
  'Roof Structure',
  'Roof Covering',
  'Shopfront / Entrances',
  'Windows & Doors',
  'Partitioning',
  'Plastering',
  'Ceilings',
  'Flooring',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Painting',
  'External Works',
  'Finishing',
];

const MIXED_USE_STAGES = [
  'Site Clearing',
  'Foundation',
  'Slab',
  'Walls',
  'Steel Structure',
  'Roof Structure',
  'Roof Covering',
  'Shopfront / Entrances',
  'Windows & Doors',
  'Partitioning',
  'Plastering',
  'Ceilings',
  'Flooring',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Painting',
  'External Works',
  'Finishing',
];

export const PROPERTY_STAGE_SUGGESTIONS: Record<string, string[]> = {
  SINGLE_HOME: RESIDENTIAL_STAGES,
  TOWNHOUSE: RESIDENTIAL_STAGES,
  CLUSTER: RESIDENTIAL_STAGES,
  FLAT_APARTMENT: RESIDENTIAL_STAGES,
  WAREHOUSE: WAREHOUSE_STAGES,
  COMMERCIAL: COMMERCIAL_STAGES,
  MIXED_USE: MIXED_USE_STAGES,
  OTHER: [
    'Site Clearing',
    'Foundation',
    'Slab',
    'Walls',
    'Roof Structure',
    'Roof Covering',
    'Windows & Doors',
    'Plumbing',
    'Electrical',
    'Painting',
    'Finishing',
  ],
};

export function suggestedStagesForPropertyType(type: string): string[] {
  return [...(PROPERTY_STAGE_SUGGESTIONS[type] || PROPERTY_STAGE_SUGGESTIONS.OTHER)];
}

const LEGACY_STAGES = [
  'Site Clearing',
  'Foundation',
  'Slab',
  'Walls',
  'Steel Structure',
  'Roof Structure',
  'Roof Covering',
  'Cladding',
  'Windows & Doors',
  'Shopfront / Entrances',
  'Loading Bays',
  'Partitioning',
  'Plastering',
  'Ceilings',
  'Flooring',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Painting',
  'External Works',
  'Finishing',
];

export function quoteStageLabel(_section?: string | null, description?: string | null) {
  return (description || '').trim();
}

function quoteDescription(stage: string) {
  const parts = stage.split(' · ');
  return (parts.length > 1 ? parts.slice(1).join(' · ') : stage).trim().toLowerCase();
}

/** Same as quoteDescription without a trailing "(section)" qualifier. */
function baseDescription(stage: string) {
  return quoteDescription(stage).replace(/\s*\([^)]*\)\s*$/, '');
}

type QuotePick = 'first' | 'last';
type QuoteCandidate = { description: string; pick: QuotePick };
const cand = (description: string, pick: QuotePick = 'first'): QuoteCandidate => ({
  description,
  pick,
});

/**
 * Older labels (stage templates, earlier BOQs) pointed at the BOQ stage they stand for.
 * Each label lists the BOQ descriptions it may map to; the first one the BOQ has wins.
 * Mirrors apps/api/src/labour-revenue/quote-stages.ts.
 */
const QUOTE_STAGE_ALIASES: Record<string, QuoteCandidate[]> = {
  'back filling and compacting concrete slab': [cand('concrete slab')],
  'concrete roof deck 1': [cand('concrete roof deck'), cand('concrete deck')],
  'concrete roof deck 2': [cand('concrete roof deck'), cand('concrete deck')],
  'concrete roof deck': [cand('concrete deck')],
  'deck concrete': [cand('concrete deck')],
  'roof deck steel fixing 1': [cand('roof deck steel fixing'), cand('deck steel fixing')],
  'roof deck steel fixing 2': [cand('roof deck steel fixing'), cand('deck steel fixing')],
  'roof deck steel fixing': [cand('deck steel fixing')],
  'parapet and wall coping': [cand('parrapet and wall couping'), cand('parapet wall')],
  'parrapet and wall couping': [cand('parapet wall')],
  'site clearing': [cand('land clearing'), cand('site clearance')],
  'land clearing': [cand('site clearance')],
  'setting out': [cand('column excavation')],
  'trench excavation': [cand('column excavation')],
  'back filling and compacting': [cand('back filling')],
  'fixing of bases, columns and ground beams': [cand('steel fixing of bases and stubs')],
  'shuttering of bases columns and beams': [cand('shuttering of stubs')],
  foundation: [cand('concrete bases')],
  slab: [cand('concrete slab')],
  'concrete slab': [cand('concrete slab')],
  walls: [cand('average level'), cand('window level')],
  // The older "Average level" start was the start of the roof deck section, which on the
  // labour stages BOQs begins at deck steel fixing.
  'average level': [cand('average level', 'last'), cand('deck steel fixing')],
  'window level': [cand('window level', 'last')],
  'shattering of ring beam': [cand('ring beam shuttering')],
  'shuttering of ring beam': [cand('ring beam shuttering', 'last')],
  'steel fixing of ring beam': [cand('ring beam steel fixing')],
  'ring beam concrete': [cand('concrete ring beam')],
  'steel fixing': [cand('ring beam steel fixing', 'last')],
  'wall plate ff': [cand('wall plate', 'last')],
  'steel structure': [cand('steel fixing of ring beam'), cand('ring beam steel fixing')],
  'roof structure': [cand('wall plate')],
  plumbing: [cand('plumbing fix and supply'), cand('plumbing')],
  'plumbing fix and supply': [cand('plumbing')],
};

function pickQuoteStage(quoteStages: string[], description: string, pick: QuotePick) {
  const matches = quoteStages.filter((stage) => baseDescription(stage) === description);
  if (!matches.length) return '';
  return pick === 'first' ? matches[0] : matches[matches.length - 1];
}

/**
 * Map a stored stage onto one of a BOQ's stages. A house with a BOQ has only that BOQ's
 * stages, so with `strict` a label the BOQ does not have returns '' instead of the label.
 */
export function resolveQuoteStage(
  label: string | null | undefined,
  quoteStages: string[],
  strict = false,
) {
  const raw = (label || '').trim();
  if (!raw) return '';
  if (!quoteStages.length) return strict ? '' : raw;
  const lower = raw.toLowerCase();
  const exact = quoteStages.find((stage) => stage.toLowerCase() === lower);
  if (exact) return exact;
  const bare = quoteDescription(raw);
  const keys = bare !== lower ? [lower, bare] : [lower];
  for (const key of keys) {
    for (const alias of QUOTE_STAGE_ALIASES[key] || []) {
      const aliased = pickQuoteStage(quoteStages, alias.description, alias.pick);
      if (aliased) return aliased;
    }
  }
  for (const key of keys) {
    const described = pickQuoteStage(quoteStages, key, 'last');
    if (described) return described;
  }
  for (const key of keys) {
    const stripped = key.replace(/ \d+$/, '');
    if (stripped === key) continue;
    const numbered = pickQuoteStage(quoteStages, stripped, 'first');
    if (numbered) return numbered;
  }
  return strict ? '' : raw;
}

/** The stage labels a house's own BOQ lines define, in order. */
export function boqStageValues(
  lines: { stageName?: string | null; sectionName?: string | null; sortOrder?: number }[] | null | undefined,
) {
  return quoteStageOptions([{ lines: lines || [] }]).map((stage) => stage.value);
}

function stageMoney(cents: number) {
  return `USD ${(Number(cents || 0) / 100).toFixed(2)}`;
}

export function quoteStageOptions(
  boqs: {
    name?: string;
    lines?: {
      sectionName?: string | null;
      stageName?: string | null;
      sortOrder?: number;
      amountCents?: number | string;
    }[];
  }[],
) {
  const ordered = (boqs || [])
    .map((boq) => ({
      name: boq.name?.trim() || '',
      lines: [...(boq.lines || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }))
    .sort((a, b) => b.lines.length - a.lines.length);
  const rows = new Map<string, { value: string; prices: { name: string; cents: number }[] }>();
  const order: string[] = [];
  for (const boq of ordered) {
    for (const line of boq.lines) {
      const value = quoteStageLabel(line.sectionName, line.stageName);
      const key = value.toLowerCase();
      if (!value) continue;
      if (!rows.has(key)) {
        rows.set(key, { value, prices: [] });
        order.push(key);
      }
      const cents = Math.round(Number(line.amountCents) || 0);
      rows.get(key)!.prices.push({ name: boq.name, cents });
    }
  }
  return order.map((key) => {
    const row = rows.get(key)!;
    const amounts = [...new Set(row.prices.map((price) => price.cents))];
    const priceText =
      amounts.length <= 1
        ? stageMoney(amounts[0] || 0)
        : row.prices.map((price) => `${price.name || 'BOQ'} ${stageMoney(price.cents)}`).join(' · ');
    return { value: row.value, label: `${row.value} · ${priceText}` };
  });
}

/** Share of the build sequence reached by the selected stage. The last stage is 100%. */
export function stageCompletionPercent(
  currentStage: string,
  templates?: { name: string; sortOrder: number }[],
  quoteStages?: string[],
): number | null {
  const name = currentStage.trim().toLowerCase();
  if (!name) return null;
  if (quoteStages?.length) {
    const quoteIndex = quoteStages.findIndex((stage) => stage.toLowerCase() === name);
    if (quoteIndex >= 0) return Math.round(((quoteIndex + 1) / quoteStages.length) * 100);
  }
  const sequences = templates?.length
    ? [
        templates.filter((stage) => stage.sortOrder < 100).map((stage) => stage.name),
        templates.filter((stage) => stage.sortOrder >= 100).map((stage) => stage.name),
      ]
    : [RESIDENTIAL_STAGES, LEGACY_STAGES];
  for (const sequence of sequences) {
    if (!sequence.length) continue;
    const index = sequence.findIndex((stage) => stage.toLowerCase() === name);
    if (index >= 0) return Math.round(((index + 1) / sequence.length) * 100);
  }
  return null;
}

export function propertyTypeStageLabel(type: string): string {
  const labels: Record<string, string> = {
    SINGLE_HOME: 'single home',
    TOWNHOUSE: 'townhouse',
    CLUSTER: 'cluster',
    FLAT_APARTMENT: 'flat / apartment',
    WAREHOUSE: 'warehouse',
    COMMERCIAL: 'commercial',
    MIXED_USE: 'mixed use',
    OTHER: 'general',
  };
  return labels[type] || 'general';
}
