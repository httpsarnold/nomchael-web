'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { BusyOverlay, LoadingState } from '@/components/LoadingState';
import { api, downloadPdf, money } from '@/lib/api';

type Line = { description: string; unit: string; quantity: string; unitPrice: string };

const emptyLine = (): Line => ({ description: '', unit: '', quantity: '1', unitPrice: '' });

const emptyForm = () => ({
  clientName: '',
  clientPhone: '',
  clientAddress: '',
  title: '',
  validUntil: '',
  discount: '',
  notes: '',
});

function lineTotalCents(l: Line) {
  const qty = Number(l.quantity);
  const price = Number(l.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * Math.round(price * 100));
}

export default function QuickQuotationPage() {
  const [form, setForm] = useState(emptyForm());
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
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

  const subtotalCents = useMemo(
    () => lines.reduce((s, l) => s + (l.description.trim() ? lineTotalCents(l) : 0), 0),
    [lines],
  );
  const discountCents = Math.min(
    Math.max(0, Math.round(Number(form.discount || 0) * 100)),
    subtotalCents,
  );
  const totalCents = subtotalCents - discountCents;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, idx) => idx !== i)));
  }

  function resetForm() {
    setForm(emptyForm());
    setLines([emptyLine()]);
    setEditingId('');
    setEditingNumber('');
  }

  async function openSaved(id: string) {
    setError('');
    setInfo('');
    try {
      const q = await api<any>(`/quick-quotations/${id}`);
      setEditingId(q.id);
      setEditingNumber(q.number);
      setForm({
        clientName: q.clientName || '',
        clientPhone: q.clientPhone || '',
        clientAddress: q.clientAddress || '',
        title: q.title || '',
        validUntil: q.validUntil ? String(q.validUntil).slice(0, 10) : '',
        discount: q.discountCents ? String(q.discountCents / 100) : '',
        notes: q.notes || '',
      });
      setLines(
        q.items.map((i: any) => ({
          description: i.description,
          unit: i.unit || '',
          quantity: String(i.quantity),
          unitPrice: String(i.unitPriceCents / 100),
        })),
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(download: boolean) {
    setError('');
    setInfo('');
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        unit: l.unit.trim() || undefined,
        quantity: Number(l.quantity),
        unitPriceCents: Math.round(Number(l.unitPrice || 0) * 100),
      }));
    if (!form.clientName.trim()) {
      setError('Enter the client name.');
      return;
    }
    if (!items.length) {
      setError('Add at least one item with a description.');
      return;
    }
    if (items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      setError('Every item needs a quantity above 0.');
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim() || undefined,
        clientAddress: form.clientAddress.trim() || undefined,
        title: form.title.trim() || undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes.trim() || undefined,
        discountCents,
        items,
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
      <h1>Quick quotation</h1>
      <p className="muted">
        A once-off quotation that is not linked to a project. Enter the items, check the total,
        then save and download the PDF. Saved quotations are listed below so you can download or
        edit them again.
      </p>
      {error && <p className="error">{error}</p>}
      {info && <p className="success">{info}</p>}

      <form className="panel" onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>
          {editingId ? `Editing ${editingNumber}` : 'New quotation'}
        </h3>
        <div className="form grid grid-3">
          <label>
            Client name
            <input
              required
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
          </label>
          <label>
            Client phone
            <input
              value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
            />
          </label>
          <label>
            Client address
            <input
              value={form.clientAddress}
              onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
            />
          </label>
          <label>
            Title (optional)
            <input
              value={form.title}
              placeholder="e.g. Boundary wall at 12 Main Rd"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Valid until (optional)
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </label>
        </div>

        <div className="table-wrap" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Item / description</th>
                <th style={{ width: 90 }}>Unit</th>
                <th style={{ width: 100 }}>Quantity</th>
                <th style={{ width: 130 }}>Unit price</th>
                <th style={{ width: 130, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      value={l.description}
                      placeholder="e.g. Cement 50kg"
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      value={l.unit}
                      placeholder="bags"
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitPrice}
                      placeholder="0.00"
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{money(lineTotalCents(l))}</strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '0.2rem 0.5rem' }}
                      onClick={() => removeLine(i)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: '0.5rem' }}
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + Add item
        </button>

        <div className="grid grid-2" style={{ marginTop: '1rem', alignItems: 'start' }}>
          <div className="form">
            <label>
              Notes / terms (optional)
              <textarea
                rows={3}
                value={form.notes}
                placeholder="e.g. 50% deposit required. Prices exclude transport."
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0.25rem 0' }}>
              <span className="muted">Subtotal </span>
              <strong>{money(subtotalCents)}</strong>
            </p>
            <label style={{ display: 'inline-block', textAlign: 'left', margin: '0.25rem 0' }}>
              Discount (optional)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
            </label>
            <p style={{ fontSize: '1.3rem', margin: '0.5rem 0' }}>
              <span className="muted">Total </span>
              <strong>{money(totalCents)}</strong>
            </p>
          </div>
        </div>

        <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8, marginTop: '0.5rem' }}>
          <button type="submit" className="btn" disabled={saving}>
            Save and download PDF
          </button>
          <button type="button" className="btn secondary" disabled={saving} onClick={() => save(false)}>
            Save only
          </button>
          <button type="button" className="btn secondary" onClick={resetForm}>
            {editingId ? 'Start a new quotation' : 'Clear'}
          </button>
        </div>
      </form>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Saved quick quotations</h3>
        <label style={{ maxWidth: 360, display: 'block' }}>
          Search
          <input
            value={search}
            placeholder="Client, number or title"
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
                  <th>Client</th>
                  <th>Title</th>
                  <th>Items</th>
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
                    <td>{q._count?.items ?? ''}</td>
                    <td>{money(q.totalCents)}</td>
                    <td>{new Date(q.createdAt).toLocaleDateString()}</td>
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
                    <td colSpan={7} className="muted">
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
