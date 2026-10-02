'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { BusyOverlay, LoadingState } from '@/components/LoadingState';
import { api, downloadPdf, money } from '@/lib/api';

type Material = {
  quantity: string;
  unit: string;
  description: string;
  unitCost: string;
  lumpSum: string;
};
type Labour = { description: string; amount: string };
type Section = { name: string; materials: Material[]; labour: Labour[] };

const SECTION_SUGGESTIONS = [
  'SETTING OUT TO SLAB',
  'SUPER STRUCTURE FROM SLAB TO FF FLOOR',
  'FF SLAB TO ROOF DECK',
  'SLAB TO WALLPLATE',
  'ROOFING',
  'PLASTERING',
  'PLUMBING',
  'ELECTRICAL',
  'FINISHES',
];

const emptyMaterial = (): Material => ({
  quantity: '',
  unit: '',
  description: '',
  unitCost: '',
  lumpSum: '',
});
const emptyLabour = (): Labour => ({ description: '', amount: '' });
const emptySection = (name = ''): Section => ({
  name,
  materials: [emptyMaterial()],
  labour: [emptyLabour()],
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  quoteDate: today(),
  clientName: '',
  subject: 'BILL OF QUANTITIES',
  preparedBy: '',
  clientPhone: '',
  clientAddress: '',
  title: '',
  validUntil: '',
  notes: '',
});

function toCents(v: string) {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function toQty(v: string) {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function materialTotalCents(m: Material) {
  const qty = toQty(m.quantity);
  const unit = toCents(m.unitCost);
  if (qty !== null && unit !== null) return Math.round(qty * unit);
  return toCents(m.lumpSum) ?? 0;
}

function sectionTotals(s: Section) {
  const materials = s.materials.reduce(
    (t, m) => t + (m.description.trim() ? materialTotalCents(m) : 0),
    0,
  );
  const labour = s.labour.reduce(
    (t, l) => t + (l.description.trim() ? toCents(l.amount) ?? 0 : 0),
    0,
  );
  return { materials, labour };
}

const cellInput: CSSProperties = { width: '100%' };
const smallBtn: CSSProperties = { padding: '0.2rem 0.5rem' };

export default function QuickQuotationPage() {
  const [form, setForm] = useState(emptyForm());
  const [sections, setSections] = useState<Section[]>([emptySection('SETTING OUT TO SLAB')]);
  const [showMore, setShowMore] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingNumber, setEditingNumber] = useState('');
  const [saved, setSaved] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function loadSaved(q = search) {
    const path = q.trim() ? `/quick-quotations?q=${encodeURIComponent(q.trim())}` : '/quick-quotations';
    setSaved(await api(path));
  }

  useEffect(() => {
    loadSaved('')
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadSaved().catch(() => undefined), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totals = useMemo(() => {
    let materials = 0;
    let labour = 0;
    for (const s of sections) {
      const t = sectionTotals(s);
      materials += t.materials;
      labour += t.labour;
    }
    return { materials, labour, grand: materials + labour };
  }, [sections]);

  function updateSection(si: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }

  function updateMaterial(si: number, mi: number, patch: Partial<Material>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, materials: s.materials.map((m, j) => (j === mi ? { ...m, ...patch } : m)) }
          : s,
      ),
    );
  }

  function updateLabour(si: number, li: number, patch: Partial<Labour>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, labour: s.labour.map((l, j) => (j === li ? { ...l, ...patch } : l)) }
          : s,
      ),
    );
  }

  function removeMaterial(si: number, mi: number) {
    const s = sections[si];
    updateSection(si, {
      materials:
        s.materials.length === 1 ? [emptyMaterial()] : s.materials.filter((_, j) => j !== mi),
    });
  }

  function removeLabour(si: number, li: number) {
    const s = sections[si];
    updateSection(si, {
      labour: s.labour.length === 1 ? [emptyLabour()] : s.labour.filter((_, j) => j !== li),
    });
  }

  function removeSection(si: number) {
    const s = sections[si];
    const hasData =
      s.materials.some((m) => m.description.trim()) || s.labour.some((l) => l.description.trim());
    if (hasData && !window.confirm(`Remove section "${s.name || si + 1}" and all its lines?`)) return;
    setSections((prev) => (prev.length === 1 ? [emptySection()] : prev.filter((_, i) => i !== si)));
  }

  function moveSection(si: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = si + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[si], next[target]] = [next[target], next[si]];
      return next;
    });
  }

  function resetForm() {
    setForm(emptyForm());
    setSections([emptySection('SETTING OUT TO SLAB')]);
    setEditingId('');
    setEditingNumber('');
    setShowMore(false);
  }

  async function openSaved(id: string) {
    setError('');
    setInfo('');
    try {
      const q = await api<any>(`/quick-quotations/${id}`);
      setEditingId(q.id);
      setEditingNumber(q.number);
      const next = {
        quoteDate: q.quoteDate ? String(q.quoteDate).slice(0, 10) : today(),
        clientName: q.clientName || '',
        subject: q.subject || 'BILL OF QUANTITIES',
        preparedBy: q.preparedBy || '',
        clientPhone: q.clientPhone || '',
        clientAddress: q.clientAddress || '',
        title: q.title || '',
        validUntil: q.validUntil ? String(q.validUntil).slice(0, 10) : '',
        notes: q.notes || '',
      };
      setForm(next);
      setShowMore(
        !!(next.clientPhone || next.clientAddress || next.title || next.validUntil || next.notes),
      );
      const loaded: Section[] = (q.sections || []).map((s: any) => {
        const materials: Material[] = s.items
          .filter((i: any) => i.kind === 'MATERIAL')
          .map((i: any) => ({
            quantity: i.quantity !== null && i.quantity !== undefined ? String(i.quantity) : '',
            unit: i.unit || '',
            description: i.description,
            unitCost: i.unitPriceCents !== null && i.unitPriceCents !== undefined ? String(i.unitPriceCents / 100) : '',
            lumpSum:
              (i.unitPriceCents === null || i.unitPriceCents === undefined) && i.totalCents
                ? String(i.totalCents / 100)
                : '',
          }));
        const labour: Labour[] = s.items
          .filter((i: any) => i.kind === 'LABOUR')
          .map((i: any) => ({ description: i.description, amount: String(i.totalCents / 100) }));
        return {
          name: s.name || '',
          materials: materials.length ? materials : [emptyMaterial()],
          labour: labour.length ? labour : [emptyLabour()],
        };
      });
      setSections(loaded.length ? loaded : [emptySection()]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(download: boolean) {
    setError('');
    setInfo('');
    if (!form.clientName.trim()) {
      setError('Enter the customer name.');
      return;
    }
    const payloadSections = sections.map((s) => ({
      name: s.name.trim() || undefined,
      materials: s.materials
        .filter((m) => m.description.trim())
        .map((m) => {
          const unitPriceCents = toCents(m.unitCost);
          return {
            quantity: toQty(m.quantity),
            unit: m.unit.trim() || undefined,
            description: m.description.trim(),
            unitPriceCents,
            totalCents: unitPriceCents === null ? toCents(m.lumpSum) : null,
          };
        }),
      labour: s.labour
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), amountCents: toCents(l.amount) ?? 0 })),
    }));
    if (!payloadSections.some((s) => s.materials.length || s.labour.length)) {
      setError('Add at least one material or labour line.');
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        quoteDate: form.quoteDate || undefined,
        clientName: form.clientName.trim(),
        subject: form.subject.trim() || undefined,
        preparedBy: form.preparedBy.trim() || undefined,
        clientPhone: form.clientPhone.trim() || undefined,
        clientAddress: form.clientAddress.trim() || undefined,
        title: form.title.trim() || undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes.trim() || undefined,
        sections: payloadSections,
      });
      const q = await api<any>(editingId ? `/quick-quotations/${editingId}` : '/quick-quotations', {
        method: editingId ? 'PUT' : 'POST',
        body,
      });
      setEditingId(q.id);
      setEditingNumber(q.number);
      if (download) {
        await downloadPdf(`/quick-quotations/${q.id}/pdf`, `${q.number}-${q.clientName}.pdf`);
      }
      setInfo(`${q.number} saved${download ? ' and downloaded' : ''}.`);
      await loadSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSaved(q: any) {
    if (!window.confirm(`Delete quotation ${q.number} for ${q.clientName}?`)) return;
    setError('');
    try {
      await api(`/quick-quotations/${q.id}`, { method: 'DELETE' });
      if (editingId === q.id) resetForm();
      setInfo(`${q.number} deleted.`);
      await loadSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save(true);
  }

  return (
    <AppShell>
      {saving && <BusyOverlay label="Saving quotation…" />}
      <h1>Quick quotation (Bill of Quantities)</h1>
      <p className="muted">
        A once-off bill of quantities that is not linked to a project. Split the work into sections
        (for example Setting out to slab). Each section has its own materials and labour, with
        totals worked out for you. The PDF follows the Nomchael letterhead layout.
      </p>
      {error && <p className="error">{error}</p>}
      {info && <p className="success">{info}</p>}

      <datalist id="boq-section-names">
        {SECTION_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="boq-units">
        {['m3', 'm2', 'm', 'bags', 'kg', 'ltrs', 'pcs', 'lengths', 'rolls', 'sheets'].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <form onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>
            {editingId ? `Editing ${editingNumber}` : 'New bill of quantities'}
          </h3>
          <div className="form grid grid-2">
            <label>
              Date
              <input
                type="date"
                value={form.quoteDate}
                onChange={(e) => setForm({ ...form, quoteDate: e.target.value })}
              />
            </label>
            <label>
              Customer
              <input
                required
                value={form.clientName}
                placeholder="e.g. Mandevilla"
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </label>
            <label>
              RE (subject)
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label>
              Prepared by
              <input
                value={form.preparedBy}
                placeholder="Name to print at the bottom"
                onChange={(e) => setForm({ ...form, preparedBy: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Hide extra details' : 'Add phone, address, project, validity or notes'}
          </button>
          {showMore && (
            <div className="form grid grid-2" style={{ marginTop: '0.75rem' }}>
              <label>
                Customer phone
                <input
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                />
              </label>
              <label>
                Customer address
                <input
                  value={form.clientAddress}
                  onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                />
              </label>
              <label>
                Project
                <input
                  value={form.title}
                  placeholder="e.g. Cottage House"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Valid until
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Notes (printed after the totals)
                <textarea
                  rows={3}
                  value={form.notes}
                  placeholder="e.g. Client to hire compacting machine. 30% labour deposit paid before starting work."
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>

        {sections.map((s, si) => {
          const t = sectionTotals(s);
          return (
            <div
              key={si}
              className="panel"
              style={{ marginTop: '1rem', borderLeft: '4px solid #1f3864' }}
            >
              <div
                style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}
              >
                <label className="form" style={{ flex: '1 1 320px' }}>
                  Section {si + 1} heading
                  <input
                    list="boq-section-names"
                    value={s.name}
                    placeholder="e.g. SETTING OUT TO SLAB"
                    onChange={(e) => updateSection(si, { name: e.target.value })}
                    style={{ fontWeight: 600 }}
                  />
                </label>
                <div className="row-actions" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={smallBtn}
                    disabled={si === 0}
                    onClick={() => moveSection(si, -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={smallBtn}
                    disabled={si === sections.length - 1}
                    onClick={() => moveSection(si, 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={smallBtn}
                    onClick={() => removeSection(si)}
                  >
                    Remove section
                  </button>
                </div>
              </div>

              <h4 style={{ margin: '1rem 0 0.25rem' }}>Materials</h4>
              <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                Enter quantity and unit cost to calculate the total, or leave unit cost blank and
                type a lump sum total (for example sand or stones by the load).
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Qty</th>
                      <th style={{ width: 90 }}>Unit</th>
                      <th>Description</th>
                      <th style={{ width: 120 }}>Unit cost (US$)</th>
                      <th style={{ width: 130, textAlign: 'right' }}>Total cost (US$)</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.materials.map((m, mi) => {
                      const auto = toQty(m.quantity) !== null && toCents(m.unitCost) !== null;
                      return (
                        <tr key={mi}>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={m.quantity}
                              onChange={(e) => updateMaterial(si, mi, { quantity: e.target.value })}
                              style={cellInput}
                            />
                          </td>
                          <td>
                            <input
                              list="boq-units"
                              value={m.unit}
                              placeholder="bags"
                              onChange={(e) => updateMaterial(si, mi, { unit: e.target.value })}
                              style={cellInput}
                            />
                          </td>
                          <td>
                            <input
                              value={m.description}
                              placeholder="e.g. Cement"
                              onChange={(e) =>
                                updateMaterial(si, mi, { description: e.target.value })
                              }
                              style={cellInput}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={m.unitCost}
                              onChange={(e) => updateMaterial(si, mi, { unitCost: e.target.value })}
                              style={cellInput}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {auto || m.unitCost.trim() ? (
                              <strong>{money(materialTotalCents(m))}</strong>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={m.lumpSum}
                                placeholder="Lump sum"
                                onChange={(e) => updateMaterial(si, mi, { lumpSum: e.target.value })}
                                style={{ ...cellInput, textAlign: 'right' }}
                              />
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              style={smallBtn}
                              onClick={() => removeMaterial(si, mi)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={4}>
                        <strong>Total Material Cost</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{money(t.materials)}</strong>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: '0.5rem' }}
                onClick={() => updateSection(si, { materials: [...s.materials, emptyMaterial()] })}
              >
                + Add material
              </button>

              <h4 style={{ margin: '1.25rem 0 0.5rem' }}>Labour</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: 160, textAlign: 'right' }}>Amount (US$)</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.labour.map((l, li) => (
                      <tr key={li}>
                        <td>
                          <input
                            value={l.description}
                            placeholder="e.g. Setting out"
                            onChange={(e) => updateLabour(si, li, { description: e.target.value })}
                            style={cellInput}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.amount}
                            onChange={(e) => updateLabour(si, li, { amount: e.target.value })}
                            style={{ ...cellInput, textAlign: 'right' }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn secondary"
                            style={smallBtn}
                            onClick={() => removeLabour(si, li)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <strong>Total Labour Cost</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{money(t.labour)}</strong>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: '0.5rem' }}
                onClick={() => updateSection(si, { labour: [...s.labour, emptyLabour()] })}
              >
                + Add labour
              </button>
            </div>
          );
        })}

        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: '1rem' }}
          onClick={() => setSections((prev) => [...prev, emptySection()])}
        >
          + Add section
        </button>

        <div className="panel" style={{ marginTop: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0.25rem 0' }}>
              <span className="muted">Total material cost for the whole house </span>
              <strong>{money(totals.materials)}</strong>
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <span className="muted">Total labour cost </span>
              <strong>{money(totals.labour)}</strong>
            </p>
            <p style={{ fontSize: '1.3rem', margin: '0.5rem 0' }}>
              <span className="muted">Grand total </span>
              <strong>{money(totals.grand)}</strong>
            </p>
          </div>
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8, marginTop: '0.5rem' }}>
            <button type="submit" className="btn" disabled={saving}>
              Save and download PDF
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={saving}
              onClick={() => save(false)}
            >
              Save only
            </button>
            <button type="button" className="btn secondary" onClick={resetForm}>
              {editingId ? 'Start a new quotation' : 'Clear'}
            </button>
          </div>
        </div>
      </form>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Saved quick quotations</h3>
        <label style={{ maxWidth: 360, display: 'block' }}>
          Search
          <input
            value={search}
            placeholder="Customer, number or project"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {loading && <LoadingState label="Loading quotations…" compact />}
        {!loading && (
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Project</th>
                  <th>Materials</th>
                  <th>Labour</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {saved.map((q) => (
                  <tr
                    key={q.id}
                    style={{
                      background: editingId === q.id ? 'rgba(180, 83, 9, 0.08)' : undefined,
                    }}
                  >
                    <td>{q.number}</td>
                    <td>{q.clientName}</td>
                    <td>{q.title || <span className="muted">None</span>}</td>
                    <td>{money(q.materialsTotalCents)}</td>
                    <td>{money(q.labourTotalCents)}</td>
                    <td>{money(q.totalCents)}</td>
                    <td>{new Date(q.quoteDate || q.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() =>
                            downloadPdf(
                              `/quick-quotations/${q.id}/pdf`,
                              `${q.number}-${q.clientName}.pdf`,
                            ).catch((e) => setError(e.message))
                          }
                        >
                          PDF
                        </button>
                        <button type="button" className="btn secondary" onClick={() => openSaved(q.id)}>
                          Edit
                        </button>
                        <button type="button" className="btn secondary" onClick={() => removeSaved(q)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!saved.length && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No quick quotations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
