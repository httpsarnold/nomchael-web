'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

let cachedStages: string[] | null = null;

export function useStageOptions() {
  const [stages, setStages] = useState<string[]>(cachedStages || []);
  useEffect(() => {
    if (cachedStages) return;
    api<{ name: string }[]>('/stage-templates')
      .then((list) => {
        cachedStages = list.map((s) => s.name);
        setStages(cachedStages);
      })
      .catch(() => setStages([]));
  }, []);
  return stages;
}

export function StageSelect({
  value,
  onChange,
  stages,
  emptyLabel = 'Not set',
  keepOption = false,
}: {
  value: string;
  onChange: (value: string) => void;
  stages: string[];
  emptyLabel?: string;
  keepOption?: boolean;
}) {
  const options = value && value !== '__KEEP__' && !stages.includes(value) ? [value, ...stages] : stages;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {keepOption && <option value="__KEEP__">Leave unchanged</option>}
      <option value="">{emptyLabel}</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
