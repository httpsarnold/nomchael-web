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
