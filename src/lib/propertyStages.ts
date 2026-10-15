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

export function quoteStageLabel(section?: string | null, description?: string | null) {
  const name = (description || '').trim();
  const sectionName = (section || '').trim();
  if (!name) return '';
  return sectionName ? `${sectionName} · ${name}` : name;
}

function quoteDescription(stage: string) {
  const parts = stage.split(' · ');
  return (parts.length > 1 ? parts.slice(1).join(' · ') : stage).trim().toLowerCase();
}

/** Older template names, pointed at the quotation line they stand for. */
const QUOTE_STAGE_ALIASES: Record<string, { description: string; pick: 'first' | 'last' }> = {
  'back filling and compacting concrete slab': { description: 'concrete slab', pick: 'first' },
  'concrete roof deck 1': { description: 'concrete roof deck', pick: 'first' },
  'concrete roof deck 2': { description: 'concrete roof deck', pick: 'first' },
  'roof deck steel fixing 1': { description: 'roof deck steel fixing', pick: 'first' },
  'roof deck steel fixing 2': { description: 'roof deck steel fixing', pick: 'first' },
  'parapet and wall coping': { description: 'parrapet and wall couping', pick: 'first' },
  'site clearing': { description: 'land clearing', pick: 'first' },
  foundation: { description: 'concrete bases', pick: 'first' },
  slab: { description: 'concrete slab', pick: 'first' },
  walls: { description: 'average level', pick: 'first' },
  'average level': { description: 'average level', pick: 'last' },
  'window level': { description: 'window level', pick: 'last' },
  'steel structure': { description: 'steel fixing of ring beam', pick: 'first' },
  'roof structure': { description: 'wall plate', pick: 'first' },
  plumbing: { description: 'plumbing fix and supply', pick: 'first' },
};

function pickQuoteStage(
  quoteStages: string[],
  description: string,
  pick: 'first' | 'last',
) {
  const matches = quoteStages.filter((stage) => quoteDescription(stage) === description);
  if (!matches.length) return '';
  return pick === 'first' ? matches[0] : matches[matches.length - 1];
}

/** Map a stored stage onto a quotation stage (section · description) when the estate has a BOQ. */
export function resolveQuoteStage(label: string | null | undefined, quoteStages: string[]) {
  const raw = (label || '').trim();
  if (!raw || !quoteStages.length) return raw;
  const lower = raw.toLowerCase();
  const exact = quoteStages.find((stage) => stage.toLowerCase() === lower);
  if (exact) return exact;
  const alias = QUOTE_STAGE_ALIASES[lower];
  if (alias) {
    const aliased = pickQuoteStage(quoteStages, alias.description, alias.pick);
    if (aliased) return aliased;
  }
  const described = pickQuoteStage(quoteStages, lower, 'last');
  if (described) return described;
  const stripped = lower.replace(/ \d+$/, '');
  if (stripped !== lower) {
    const numbered = pickQuoteStage(quoteStages, stripped, 'first');
    if (numbered) return numbered;
  }
  return raw;
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
