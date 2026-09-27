'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { BusyOverlay, LoadingState } from '@/components/LoadingState';
import { StageSelect, useStageOptions } from '@/components/StageSelect';
import { api, downloadFile, money } from '@/lib/api';

export default function EstateDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const stages = useStageOptions();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState({ start: '__KEEP__', current: '__KEEP__' });
  const [stageReport, setStageReport] = useState<any>(null);
  const [estate, setEstate] = useState<any>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managingId, setManagingId] = useState('');
  const [form, setForm] = useState({
    houseName: '',
    ownerName: '',
    ownerPhone: '',
    discount: '',
    discountReason: '',
    labourQuoted: '',
    startStage: '',
    currentStage: '',
  });

  const [addForm, setAddForm] = useState({
    houseName: '',
    ownerName: '',
    ownerPhone: '',
    labourQuoted: '',
    discount: '',
    discountReason: '',
    catchupStageLabel: '',
    currentStageLabel: '',
    cashReceived: '',
  });
  const [showAdd, setShowAdd] = useState(false);

  const [ledgerForm, setLedgerForm] = useState({
    kind: 'EXPENSE' as 'EXPENSE' | 'BORROWING' | 'REPAYMENT',
    amount: '',
    partyName: '',
    description: '',
  });
  const [statement, setStatement] = useState<any>(null);

  async function load() {
    const e = await api(`/estates/${id}`);
    setEstate(e);
  }

  async function loadStatement() {
    setStatement(await api(`/estates/${id}/statement`));
  }

  async function loadStageReport() {
    setStageReport(await api(`/estates/${id}/stage-report`));
  }

  async function applyBulkStages() {
    if (!selected.length) {
      setError('Tick the houses you want to update first.');
      return;
    }
    const body: Record<string, unknown> = { projectIds: selected };
    if (bulkStage.start !== '__KEEP__') body.catchupStageLabel = bulkStage.start;
    if (bulkStage.current !== '__KEEP__') body.currentStageLabel = bulkStage.current;
    if (!('catchupStageLabel' in body) && !('currentStageLabel' in body)) {
      setError('Choose a start stage, a current stage, or both.');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await api<any>(`/estates/${id}/stages`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setEstate(res.estate);
      await loadStageReport();
      setInfo(`Stages updated on ${res.applied} house${res.applied === 1 ? '' : 's'}.`);
      setSelected([]);
      setBulkStage({ start: '__KEEP__', current: '__KEEP__' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(houseId: string) {
    setSelected((prev) =>
      prev.includes(houseId) ? prev.filter((x) => x !== houseId) : [...prev, houseId],
    );
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([load(), loadStatement(), loadStageReport()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveLedger(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const st = await api(`/estates/${id}/ledger`, {
        method: 'POST',
        body: JSON.stringify({
          kind: ledgerForm.kind,
          amountCents: Math.round(Number(ledgerForm.amount) * 100),
          partyName: ledgerForm.partyName.trim() || undefined,
          description: ledgerForm.description.trim() || undefined,
        }),
      });
      setStatement(st);
      await load();
      setLedgerForm({ kind: 'EXPENSE', amount: '', partyName: '', description: '' });
      setInfo(
        ledgerForm.kind === 'BORROWING'
          ? 'Borrowing recorded. They must repay (shown as debtor of this estate).'
          : 'Entry saved on the estate statement.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openManage(h: any) {
    setManagingId(h.id);
    setShowAdd(false);
    setForm({
      houseName: h.name || '',
      ownerName: h.client?.name || '',
      ownerPhone: h.client?.phone || '',
      discount: String(Number(h.trail?.discountCents || 0) / 100),
      discountReason: h.discountReason || '',
      labourQuoted: String(Number(h.trail?.labourQuotedCents || 0) / 100),
      startStage: h.catchupStageLabel || '',
      currentStage: h.currentStageLabel || '',
    });
    setInfo('');
    setError('');
  }

  async function saveManage(e: FormEvent) {
    e.preventDefault();
    if (!managingId) return;
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const updated = await api(`/estates/${id}/houses/${managingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          houseName: form.houseName.trim() || undefined,
          ownerName: form.ownerName.trim() || undefined,
          ownerPhone: form.ownerPhone.trim() || undefined,
          discountCents: Math.round(Number(form.discount || 0) * 100),
          discountReason: form.discountReason.trim() || undefined,
          labourQuotedCents: Math.round(Number(form.labourQuoted || 0) * 100),
          catchupStageLabel: form.startStage,
          currentStageLabel: form.currentStage,
        }),
      });
      setEstate(updated);
      await loadStageReport();
      setInfo('House updated. Discount and names are on the estate statement.');
      setManagingId('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addHouse(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const updated = await api(`/estates/${id}/houses`, {
        method: 'POST',
        body: JSON.stringify({
          houseName: addForm.houseName.trim() || undefined,
          ownerName: addForm.ownerName.trim() || undefined,
          ownerPhone: addForm.ownerPhone.trim() || undefined,
          labourQuotedCents: addForm.labourQuoted
            ? Math.round(Number(addForm.labourQuoted) * 100)
            : undefined,
          discountCents: Math.round(Number(addForm.discount || 0) * 100),
          discountReason: addForm.discountReason.trim() || undefined,
          catchupStageLabel: addForm.catchupStageLabel.trim() || undefined,
          currentStageLabel: addForm.currentStageLabel.trim() || undefined,
          cashReceivedCents: addForm.cashReceived
            ? Math.round(Number(addForm.cashReceived) * 100)
            : undefined,
        }),
      });
      setEstate(updated);
      await loadStageReport();
      setShowAdd(false);
      setAddForm({
        houseName: '',
        ownerName: '',
        ownerPhone: '',
        labourQuoted: '',
        discount: '',
        discountReason: '',
        catchupStageLabel: '',
        currentStageLabel: '',
        cashReceived: '',
      });
      setInfo('New house added to this estate file.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const t = estate?.trends;
  const managing = (estate?.projects || []).find((h: any) => h.id === managingId);

  return (
    <AppShell>
      {saving && <BusyOverlay label="Saving house…" />}
      <p>
        <Link href="/estates">← Estates</Link>
        {' · '}
        <Link href={`/bulk-labour?estate=${id}`}>Bulk Labour for this file</Link>
      </p>
      {error && <p className="error">{error}</p>}
      {info && <p className="success">{info}</p>}
      {loading && <LoadingState label="Loading estate…" />}
      {!loading && estate && (
        <>
          <h1>
            {estate.name}{' '}
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {estate.code}
            </span>
          </h1>
          <p className="muted">
            {estate.houseCount} houses · base labour {money(estate.baseLabourCents)} per house
          </p>

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h3>Estate statement (trends)</h3>
            <div className="grid grid-3">
              <div>
                <div className="muted">Labour quoted</div>
                <strong>{money(t.labourQuotedCents)}</strong>
              </div>
              <div>
                <div className="muted">Discounts granted</div>
                <strong style={{ color: t.discountCents ? '#b45309' : undefined }}>
                  {money(t.discountCents)}
                </strong>
              </div>
              <div>
                <div className="muted">Net due (after discount)</div>
                <strong>{money(t.netDueCents)}</strong>
              </div>
              <div>
                <div className="muted">Cash received (DR income)</div>
                <strong>{money(t.cashReceivedCents)}</strong>
              </div>
              <div>
                <div className="muted">Labour used</div>
                <strong>{money(t.labourUsedCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Other fund uses</div>
                <strong>{money(t.otherFundUsesCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Project expenses</div>
                <strong>{money(t.expensesCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Borrowed from estate (outstanding)</div>
                <strong>{money(t.borrowingsOutstandingCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Cash at hand (on ground)</div>
                <strong>{money(t.cashAtHandCents ?? t.stillAvailableCents)}</strong>
              </div>
              <div>
                <div className="muted">Clients still owe</div>
                <strong>{money(t.clientOwesCents)}</strong>
              </div>
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Quoted − discount = net due. Cash in − labour used − expenses − borrowings + repayments
              = cash at hand. People who borrow from this estate owe it back (debtors of the estate).
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  downloadFile(`/estates/${id}/export`, `${estate.code}-labour.csv`).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                Export statement CSV
              </button>
              <Link href={`/bulk-labour?estate=${id}`} className="btn secondary">
                Bulk allocate (income / labour used)
              </Link>
              <Link href={`/reports?estate=${id}`} className="btn secondary">
                Full DR/CR report
              </Link>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowAdd(true);
                  setManagingId('');
                  setAddForm({
                    houseName: '',
                    ownerName: '',
                    ownerPhone: '',
                    labourQuoted: String(Number(estate.baseLabourCents || 0) / 100),
                    discount: '',
                    discountReason: '',
                    catchupStageLabel: '',
                    currentStageLabel: '',
                    cashReceived: '',
                  });
                }}
              >
                Add another house
              </button>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h3>Expenses &amp; borrowings (from this estate pot)</h3>
            <p className="muted">
              Record money taken from this estate’s cash for site expenses, or when someone borrows
              from the project (they must repay).
            </p>
            <form className="form grid grid-2" onSubmit={saveLedger}>
              <label>
                Type
                <select
                  value={ledgerForm.kind}
                  onChange={(e) =>
                    setLedgerForm({
                      ...ledgerForm,
                      kind: e.target.value as typeof ledgerForm.kind,
                    })
                  }
                >
                  <option value="EXPENSE">Expense (where money went)</option>
                  <option value="BORROWING">Borrowing (must repay)</option>
                  <option value="REPAYMENT">Repayment received</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ledgerForm.amount}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                />
              </label>
              <label>
                {ledgerForm.kind === 'EXPENSE' ? 'Paid to / where it went' : 'Person name'}
                <input
                  required={ledgerForm.kind !== 'EXPENSE'}
                  value={ledgerForm.partyName}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, partyName: e.target.value })}
                  placeholder={
                    ledgerForm.kind === 'EXPENSE' ? 'e.g. Cement supplier' : 'e.g. John (borrower)'
                  }
                />
              </label>
              <label>
                Note
                <input
                  value={ledgerForm.description}
                  onChange={(e) =>
                    setLedgerForm({ ...ledgerForm, description: e.target.value })
                  }
                />
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn" disabled={saving}>
                  Record on estate statement
                </button>
              </div>
            </form>

            {statement && (
              <div className="grid grid-2" style={{ marginTop: '1rem' }}>
                <div>
                  <h4>Expenses listed</h4>
                  <ul>
                    {(statement.expenses || []).map((x: any) => (
                      <li key={x.id}>
                        {money(x.amountCents)} · {x.partyName || '—'}
                        {x.description ? ` · ${x.description}` : ''}{' '}
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() =>
                            api(`/estate-ledger/${x.id}`, { method: 'DELETE' })
                              .then(async (st) => {
                                setStatement(st);
                                await load();
                              })
                              .catch((err) => setError(err.message))
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {!statement.expenses?.length && <li className="muted">None yet</li>}
                  </ul>
                </div>
                <div>
                  <h4>Borrowers (must repay / debtors of estate)</h4>
                  <ul>
                    {(statement.borrowers || []).map((b: any) => (
                      <li key={b.name}>
                        {b.name}: {money(b.outstandingCents)} outstanding
                      </li>
                    ))}
                    {!statement.borrowers?.length && <li className="muted">None yet</li>}
                  </ul>
                </div>
              </div>
            )}

            {statement?.lines && (
              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <h4>DR / CR movement</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Description</th>
                      <th>DR</th>
                      <th>CR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((l: any, i: number) => (
                      <tr key={`${l.section}-${i}`}>
                        <td>{l.section}</td>
                        <td>{l.description}</td>
                        <td>{l.debitCents ? money(l.debitCents) : '—'}</td>
                        <td>{l.creditCents ? money(l.creditCents) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showAdd && (
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <h3>
                Add house to this estate{' '}
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => setShowAdd(false)}
                >
                  Close
                </button>
              </h3>
              <form className="form grid grid-2" onSubmit={addHouse}>
                <label>
                  House name
                  <input
                    value={addForm.houseName}
                    onChange={(e) => setAddForm({ ...addForm, houseName: e.target.value })}
                    placeholder="Optional · defaults to next house number"
                  />
                </label>
                <label>
                  Owner name
                  <input
                    value={addForm.ownerName}
                    onChange={(e) => setAddForm({ ...addForm, ownerName: e.target.value })}
                    placeholder="Client / owner"
                  />
                </label>
                <label>
                  Owner phone
                  <input
                    value={addForm.ownerPhone}
                    onChange={(e) => setAddForm({ ...addForm, ownerPhone: e.target.value })}
                  />
                </label>
                <label>
                  Stage when we received it
                  <StageSelect
                    stages={stages}
                    value={addForm.catchupStageLabel}
                    onChange={(v) => setAddForm({ ...addForm, catchupStageLabel: v })}
                  />
                </label>
                <label>
                  Stage it is at now
                  <StageSelect
                    stages={stages}
                    value={addForm.currentStageLabel}
                    emptyLabel="Same as start stage"
                    onChange={(v) => setAddForm({ ...addForm, currentStageLabel: v })}
                  />
                </label>
                <label>
                  Labour quoted
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addForm.labourQuoted}
                    onChange={(e) => setAddForm({ ...addForm, labourQuoted: e.target.value })}
                  />
                </label>
                <label>
                  Discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addForm.discount}
                    onChange={(e) => setAddForm({ ...addForm, discount: e.target.value })}
                  />
                </label>
                <label>
                  Discount reason
                  <input
                    value={addForm.discountReason}
                    onChange={(e) =>
                      setAddForm({ ...addForm, discountReason: e.target.value })
                    }
                  />
                </label>
                <label>
                  Cash already received
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addForm.cashReceived}
                    onChange={(e) => setAddForm({ ...addForm, cashReceived: e.target.value })}
                  />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn" disabled={saving}>
                    Add house to estate
                  </button>
                </div>
              </form>
            </div>
          )}

          {managing && (
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <h3>
                Manage house #{managing.unitNumber}{' '}
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => setManagingId('')}
                >
                  Close
                </button>
              </h3>
              <form className="form grid grid-2" onSubmit={saveManage}>
                <label>
                  House name
                  <input
                    required
                    value={form.houseName}
                    onChange={(e) => setForm({ ...form, houseName: e.target.value })}
                  />
                </label>
                <label>
                  Owner name
                  <input
                    required
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  />
                </label>
                <label>
                  Owner phone
                  <input
                    value={form.ownerPhone}
                    onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                  />
                </label>
                <label>
                  Labour quoted
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.labourQuoted}
                    onChange={(e) => setForm({ ...form, labourQuoted: e.target.value })}
                  />
                </label>
                <label>
                  Discount for this client
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  />
                </label>
                <label>
                  Discount reason
                  <input
                    placeholder="e.g. Family discount / negotiated"
                    value={form.discountReason}
                    onChange={(e) => setForm({ ...form, discountReason: e.target.value })}
                  />
                </label>
                <label>
                  Stage when we received it
                  <StageSelect
                    stages={stages}
                    value={form.startStage}
                    onChange={(v) => setForm({ ...form, startStage: v })}
                  />
                </label>
                <label>
                  Stage it is at now
                  <StageSelect
                    stages={stages}
                    value={form.currentStage}
                    onChange={(v) => setForm({ ...form, currentStage: v })}
                  />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="muted">
                    Current trail: quoted {money(managing.trail.labourQuotedCents)} − discount{' '}
                    {money(managing.trail.discountCents)} = net {money(managing.trail.netDueCents)}.
                    Owes {money(managing.trail.clientOwesCents)}.
                  </p>
                  <button type="submit" className="btn" disabled={saving}>
                    Save house
                  </button>{' '}
                  <Link href={`/labour-catchup?id=${managing.id}`}>Open full money trail</Link>
                </div>
              </form>
            </div>
          )}

          {stageReport && (
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <h3>Stage report (estate summary)</h3>
              <div className="grid grid-3">
                <div>
                  <div className="muted">Houses</div>
                  <strong>{stageReport.summary.houseCount}</strong>
                </div>
                <div>
                  <div className="muted">Houses that moved forward</div>
                  <strong>{stageReport.summary.progressedHouses}</strong>
                </div>
                <div>
                  <div className="muted">Average stages advanced</div>
                  <strong>{stageReport.summary.averageStagesAdvanced ?? 'Not enough data'}</strong>
                </div>
              </div>
              <div className="grid grid-2" style={{ marginTop: '1rem' }}>
                <div>
                  <h4>Where houses are now</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Current stage</th>
                        <th>Houses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageReport.summary.byCurrentStage.map((s: any) => (
                        <tr key={s.stage}>
                          <td>{s.stage}</td>
                          <td>{s.houses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4>Where we started (when received)</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Start stage</th>
                        <th>Houses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageReport.summary.byStartStage.map((s: any) => (
                        <tr key={s.stage}>
                          <td>{s.stage}</td>
                          <td>{s.houses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    downloadFile(
                      `/estates/${id}/stage-report/export`,
                      `${estate.code}-stages.csv`,
                    ).catch((e) => setError(e.message))
                  }
                >
                  Export stage report CSV
                </button>
                <Link href="/reports#stages" className="btn secondary">
                  All estates stage report
                </Link>
              </div>
            </div>
          )}

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h3>Bulk assign stages</h3>
            <p className="muted">
              Tick houses in the table below, then set the stage we received them at, the stage
              they are at now, or both. Use this again any time to reassign.
            </p>
            <div className="form grid grid-3">
              <label>
                Start stage (when received)
                <StageSelect
                  keepOption
                  stages={stages}
                  value={bulkStage.start}
                  emptyLabel="Clear (not set)"
                  onChange={(v) => setBulkStage({ ...bulkStage, start: v })}
                />
              </label>
              <label>
                Current stage (now)
                <StageSelect
                  keepOption
                  stages={stages}
                  value={bulkStage.current}
                  emptyLabel="Clear (not set)"
                  onChange={(v) => setBulkStage({ ...bulkStage, current: v })}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={saving || !selected.length}
                  onClick={applyBulkStages}
                >
                  Apply to {selected.length} selected
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Houses</h3>
            <p className="muted">
              Click Manage to rename the house, set the owner, change stages, or grant an individual
              discount.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all houses"
                        checked={
                          !!estate.projects?.length &&
                          selected.length === estate.projects.length
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? estate.projects.map((h: any) => h.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>#</th>
                    <th>House / Owner</th>
                    <th>Start stage</th>
                    <th>Current stage</th>
                    <th>Quoted</th>
                    <th>Discount</th>
                    <th>Net due</th>
                    <th>Cash in</th>
                    <th>Owes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(estate.projects || []).map((h: any) => (
                    <tr
                      key={h.id}
                      style={{
                        background:
                          managingId === h.id ? 'rgba(180, 83, 9, 0.08)' : undefined,
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${h.name}`}
                          checked={selected.includes(h.id)}
                          onChange={() => toggleSelected(h.id)}
                        />
                      </td>
                      <td>{h.unitNumber}</td>
                      <td>
                        <strong>{h.name}</strong>
                        <div>{h.client?.name}</div>
                        <div className="muted">{h.code}</div>
                      </td>
                      <td>{h.catchupStageLabel || <span className="muted">Not set</span>}</td>
                      <td>{h.currentStageLabel || <span className="muted">Not set</span>}</td>
                      <td>{money(h.trail.labourQuotedCents)}</td>
                      <td>
                        {money(h.trail.discountCents)}
                        {h.discountReason ? (
                          <div className="muted">{h.discountReason}</div>
                        ) : null}
                      </td>
                      <td>{money(h.trail.netDueCents)}</td>
                      <td>{money(h.trail.cashReceivedCents)}</td>
                      <td>{money(h.trail.clientOwesCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => openManage(h)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
