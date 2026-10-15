'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

let cachedStages: string[] | null = null;

export function useStageOptions() {
  const [stages, setStages] = useState<string[]>(cachedStages || []);
  useEffect(() => {
    api<{ name: string }[]>('/stage-templates')
      .then((list) => {
        cachedStages = list.map((s) => s.name);
        setStages(cachedStages);
      })
      .catch(() => {
        if (!cachedStages) setStages([]);
      });
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
  stages: (string | { value: string; label: string })[];
  emptyLabel?: string;
  keepOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const options = stages.map((stage) =>
    typeof stage === 'string' ? { value: stage, label: stage } : stage,
  );
  const shown =
    value && value !== '__KEEP__' && !options.some((stage) => stage.value === value)
      ? [{ value, label: value }, ...options]
      : options;
  const choices = [
    ...(keepOption ? [{ value: '__KEEP__', label: 'Leave unchanged' }] : []),
    { value: '', label: emptyLabel },
    ...shown,
  ];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? choices.filter(
        (stage) =>
          stage.label.toLowerCase().includes(q) || stage.value.toLowerCase().includes(q),
      )
    : choices;
  const selected = choices.find((stage) => stage.value === value);
  const closedLabel = selected?.label || '';

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(next: string) {
    onChange(next);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="stage-search" ref={rootRef}>
      <input
        value={open ? query : closedLabel}
        placeholder={open ? 'Type to search stages' : emptyLabel}
        aria-expanded={open}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
          if (e.key === 'Enter' && filtered[0]) {
            e.preventDefault();
            choose(filtered[0].value);
          }
        }}
      />
      {open && (
        <ul className="stage-search-list">
          {filtered.length === 0 && (
            <li>
              <button type="button" disabled>
                No matching stage
              </button>
            </li>
          )}
          {filtered.map((stage) => (
            <li key={`${stage.value}-${stage.label}`}>
              <button
                type="button"
                className={stage.value === value ? 'active' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(stage.value);
                }}
              >
                {stage.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
