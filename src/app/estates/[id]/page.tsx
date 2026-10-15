'use client';

import Link from 'next/link';
import { Fragment, FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { BusyOverlay, LoadingState } from '@/components/LoadingState';
import { StageSelect, useStageOptions } from '@/components/StageSelect';
import { api, downloadFile, money } from '@/lib/api';
import {
  quoteStageLabel,
  quoteStageOptions,
  resolveQuoteStage,
  stageCompletionPercent,
} from '@/lib/propertyStages';

function StageCompletion({
  stage,
  templates,
  quoteStages,
}: {
  stage: string;
  templates: { name: string; sortOrder: number }[];
  quoteStages: string[];
}) {
  const percent = stageCompletionPercent(stage, templates, quoteStages);
  if (percent == null) return <span className="muted">Not set</span>;
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.8rem' }}>
        {percent}%
      </div>
      <div className="progress" style={{ height: 8, minWidth: 72 }}>
        <div className="progress-bar" style={{ width: `${percent}%`, background: '#16a34a' }} />
      </div>
    </div>
  );
}

export default function EstateDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const stages = useStageOptions();
  const [selected, setSelected] = useState<string[]>([]);
  const [houseQuery, setHouseQuery] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('');
  const [quotedOpen, setQuotedOpen] = useState(false);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  const [bulkStage, setBulkStage] = useState({ start: '__KEEP__', current: '__KEEP__' });
  const [stageReport, setStageReport] = useState<any>(null);
  const managePanelRef = useRef<HTMLDivElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
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
    estateBoqId: '',
  });
  const [showAdd, setShowAdd] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; sortOrder: number }[]>([]);
  const [boqLinesOpen, setBoqLinesOpen] = useState(true);
  const [boqDraft, setBoqDraft] = useState<{
    id: string;
    name: string;
    lines: { sectionName: string; stageName: string; sortOrder: number; amount: string }[];
  } | null>(null);
  const [applyBoqId, setApplyBoqId] = useState('');

  const [ledgerForm, setLedgerForm] = useState({
    kind: 'EXPENSE' as 'EXPENSE' | 'BORROWING' | 'REPAYMENT',
    expenseCategory: 'COMPANY' as 'COMPANY' | 'PROJECT',
    projectId: '',
    amount: '',
    partyName: '',
    description: '',
  });
  const [statement, setStatement] = useState<any>(null);

  function resetLedgerForm() {
    setLedgerForm({
      kind: 'EXPENSE',
      expenseCategory: 'COMPANY',
      projectId: '',
      amount: '',
      partyName: '',
      description: '',
    });
  }

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
    if (managingId) {
      managePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [managingId]);

  useEffect(() => {
    if (showAdd) {
      addPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showAdd]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      load(),
      loadStatement(),
      loadStageReport(),
      api<{ name: string; sortOrder: number }[]>('/stage-templates').then((list) =>
        setTemplates(list),
      ),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveLedger(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      if (ledgerForm.kind === 'EXPENSE') {
        if (!ledgerForm.description.trim()) {
          throw new Error('Say what the expense was for.');
        }
        if (ledgerForm.expenseCategory === 'PROJECT' && !ledgerForm.projectId) {
          throw new Error('Choose the house this project expense belongs to.');
        }
      }
      const st = await api(`/estates/${id}/ledger`, {
        method: 'POST',
        body: JSON.stringify({
          kind: ledgerForm.kind,
          amountCents: Math.round(Number(ledgerForm.amount) * 100),
          partyName: ledgerForm.partyName.trim() || undefined,
          description: ledgerForm.description.trim() || undefined,
          expenseCategory:
            ledgerForm.kind === 'EXPENSE' ? ledgerForm.expenseCategory : undefined,
          projectId:
            ledgerForm.kind === 'EXPENSE' && ledgerForm.expenseCategory === 'PROJECT'
              ? ledgerForm.projectId
              : undefined,
        }),
      });
      setStatement(st);
      await load();
      resetLedgerForm();
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
      startStage: resolveQuoteStage(
        h.catchupStageLabel,
        quoteStageOptions(estate?.boqs || []).map((stage) => stage.value),
      ),
      currentStage: resolveQuoteStage(
        h.currentStageLabel,
        quoteStageOptions(estate?.boqs || []).map((stage) => stage.value),
      ),
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

  async function clearHouseBoq() {
    if (!managing?.id || !managing.estateBoq?.name) return;
    const quote = managing.estateBoq.name;
    if (
      !window.confirm(
        `Remove ${quote} from this house? Labour quoted goes back to the amount before this quotation, and the building match is cleared.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const updated = await api<any>(`/estates/${id}/houses/${managing.id}/boq`, { method: 'DELETE' });
      setEstate(updated);
      const house = (updated.projects || []).find((h: any) => h.id === managing.id);
      if (house) {
        setForm((prev) => ({
          ...prev,
          labourQuoted: String(Number(house.trail?.labourQuotedCents || 0) / 100),
        }));
      }
      await loadStageReport();
      setInfo(`${quote} removed from this house.`);
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
          labourQuotedCents: addForm.estateBoqId
            ? undefined
            : addForm.labourQuoted
              ? Math.round(Number(addForm.labourQuoted) * 100)
              : undefined,
          discountCents: Math.round(Number(addForm.discount || 0) * 100),
          discountReason: addForm.discountReason.trim() || undefined,
          catchupStageLabel: addForm.catchupStageLabel.trim() || undefined,
          currentStageLabel: addForm.currentStageLabel.trim() || undefined,
          cashReceivedCents: addForm.cashReceived
            ? Math.round(Number(addForm.cashReceived) * 100)
            : undefined,
          estateBoqId: addForm.estateBoqId || undefined,
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
        estateBoqId: '',
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

  function blankBoqLines() {
    return [{ sectionName: '', stageName: '', sortOrder: 1, amount: '' }];
  }

  function chargeCents(
    lines: {
      sortOrder: number;
      amountCents?: number;
      amount?: string;
      stageName?: string;
      sectionName?: string;
    }[],
    startStage: string,
  ) {
    const wanted = startStage.trim().toLowerCase();
    const named = lines.find((l) => {
      const label = quoteStageLabel(l.sectionName, l.stageName).toLowerCase();
      return label === wanted || (l.stageName || '').toLowerCase() === wanted;
    });
    const startOrder = named ? named.sortOrder : null;
    return lines.reduce((sum, line) => {
      const cents =
        line.amountCents !== undefined
          ? Number(line.amountCents)
          : Math.round(Number(line.amount || 0) * 100);
      if (startOrder !== null && line.sortOrder < startOrder) return sum;
      return sum + (Number.isFinite(cents) ? cents : 0);
    }, 0);
  }

  function openBoq(boq?: any) {
    setBoqLinesOpen(true);
    if (!boq) {
      setBoqDraft({ id: '', name: '', lines: blankBoqLines() });
      return;
    }
    const lines = (boq.lines || []).map((l: any, i: number) => ({
      sectionName: l.sectionName || '',
      stageName: l.stageName,
      sortOrder: l.sortOrder ?? i + 1,
      amount: String(Number(l.amountCents) / 100),
    }));
    setBoqDraft({
      id: boq.id,
      name: boq.name || '',
      lines: lines.length ? lines : blankBoqLines(),
    });
  }

  async function saveBoq() {
    if (!boqDraft) return;
    if (!boqDraft.name.trim()) {
      setError('Give the BOQ a name.');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const body = JSON.stringify({
        name: boqDraft.name.trim(),
        lines: boqDraft.lines
          .filter((l) => l.stageName.trim())
          .map((l, i) => ({
            sectionName: l.sectionName.trim() || undefined,
            stageName: l.stageName.trim(),
            sortOrder: i + 1,
            amountCents: Math.round(Number(l.amount || 0) * 100),
          })),
      });
      const saved = await api<any>(
        boqDraft.id ? `/estates/${id}/boqs/${boqDraft.id}` : `/estates/${id}/boqs`,
        { method: boqDraft.id ? 'PATCH' : 'POST', body },
      );
      await load();
      setBoqDraft({ ...boqDraft, id: saved.id });
      setInfo(
        boqDraft.id
          ? 'BOQ updated. Houses already using it keep their copied amounts.'
          : 'BOQ saved. Apply it to the houses you want.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeBoq(boq: any) {
    if (!window.confirm(`Delete BOQ "${boq.name}"? Houses already charged keep their copied stages.`)) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/estates/${id}/boqs/${boq.id}`, { method: 'DELETE' });
      if (boqDraft?.id === boq.id) setBoqDraft(null);
      await load();
      setInfo('BOQ deleted.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function applyBoq() {
    if (!applyBoqId) {
      setError('Choose a BOQ to apply.');
      return;
    }
    if (!selected.length) {
      setError('Tick the houses you want this BOQ applied to.');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const updated = await api(`/estates/${id}/boqs/${applyBoqId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ projectIds: selected }),
      });
      setEstate(updated);
      const quoteName =
        (estate?.boqs || []).find((b: any) => b.id === applyBoqId)?.name || 'Quotation';
      setInfo(
        `${quoteName} applied to ${selected.length} house${selected.length === 1 ? '' : 's'}. They are now in the ${quoteName} group.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const addBoq = (estate?.boqs || []).find((b: any) => b.id === addForm.estateBoqId);
  const addCharge = addBoq ? chargeCents(addBoq.lines || [], addForm.catchupStageLabel) : null;
  const houseQueryText = houseQuery.trim().toLowerCase();
  const quoteNames = (estate?.boqs || []).map((b: any) => b.name).filter(Boolean);
  const hasUnquoted = (estate?.projects || []).some((h: any) => !h.estateBoq?.name);
  const quotationFilters = [...quoteNames, ...(hasUnquoted ? ['No quotation'] : [])];
  const visibleHouses = (estate?.projects || []).filter((h: any) => {
    const quote = h.estateBoq?.name || 'No quotation';
    if (quoteFilter && quote !== quoteFilter) return false;
    if (!houseQueryText) return true;
    const hay = [h.name, h.client?.name, h.code, String(h.unitNumber ?? ''), h.client?.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(houseQueryText);
  });
  const housesByQuote = new Map<string, any[]>();
  for (const house of visibleHouses) {
    const quote = house.estateBoq?.name || 'No quotation';
    const list = housesByQuote.get(quote) || [];
    list.push(house);
    housesByQuote.set(quote, list);
  }
  const houseGroups = [
    ...quoteNames.filter((name: string) => housesByQuote.has(name)),
    ...[...housesByQuote.keys()].filter((name) => !quoteNames.includes(name)),
  ].map((name) => ({ name, houses: housesByQuote.get(name) || [] }));
  const quoteChoices = quoteStageOptions(estate?.boqs || []);
  const quoteStages = quoteChoices.map((stage) => stage.value);
  const stageChoices = quoteChoices.length ? quoteChoices : stages;
  const addStageChoices = addBoq?.lines?.length ? quoteStageOptions([addBoq]) : stageChoices;
  const manageStageChoices = managing?.boqStages?.length
    ? quoteStageOptions([{ lines: managing.boqStages }])
    : stageChoices;

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
            <h3>Estate accounts</h3>
            <h4 style={{ marginBottom: '0.5rem' }}>Labour account</h4>
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
                <div className="muted">Building match discount</div>
                <strong>{money(t.buildingMatchDiscountCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Net labour due</div>
                <strong>{money(t.netDueCents)}</strong>
              </div>
              <div>
                <div className="muted">Labour cash received</div>
                <strong>{money(t.cashReceivedCents)}</strong>
              </div>
              <div>
                <div className="muted">Labour used</div>
                <strong>{money(t.labourUsedCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Project expenses</div>
                <strong>{money(t.projectExpensesCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Other fund uses</div>
                <strong>{money(t.otherFundUsesCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Borrowed (outstanding)</div>
                <strong>{money(t.borrowingsOutstandingCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Labour account balance</div>
                <strong>{money(t.labourBalanceCents ?? 0)}</strong>
              </div>
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem' }}>Company / profit account</h4>
            <div className="grid grid-3">
              <div>
                <div className="muted">Profit earned</div>
                <strong>{money(t.profitEarnedCents ?? 0)}</strong>
              </div>
              <div>
                <div className="muted">Company expenses</div>
                <strong>{money(t.companyExpensesCents || 0)}</strong>
              </div>
              <div>
                <div className="muted">Profit left</div>
                <strong>{money(t.profitBalanceCents ?? 0)}</strong>
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
              Project expenses come from the labour account. Company expenses come from profit
              (net labour due − labour used − project expenses). Building match discount keeps
              older houses at the labour amount already allocated when a stage BOQ is applied.
              Cash at hand = labour balance − company expenses. Borrowings come from the labour pot
              and must be repaid.
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
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  downloadFile(
                    `/estates/${id}/export?format=pdf`,
                    `${estate.code}-labour.pdf`,
                  ).catch((e) => setError(e.message))
                }
              >
                Export statement PDF
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
                    estateBoqId: '',
                  });
                }}
              >
                Add another house
              </button>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h3>Stage BOQs</h3>
            <p className="muted">
              Tick the houses, select a quotation, then apply. Those houses move into that
              quotation group. Stages before a house’s start stage are not charged. Editing a
              quotation later does not change houses it was already applied to.
            </p>
            <div className="form grid grid-2" style={{ marginBottom: '0.75rem' }}>
              <label>
                Quotation
                <select value={applyBoqId} onChange={(e) => setApplyBoqId(e.target.value)}>
                  <option value="">Select a quotation</option>
                  {(estate.boqs || []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={saving || !applyBoqId || !selected.length}
                  onClick={applyBoq}
                >
                  Apply{' '}
                  {(estate.boqs || []).find((b: any) => b.id === applyBoqId)?.name || 'quotation'}{' '}
                  to {selected.length} selected
                </button>
                <button type="button" className="btn secondary" onClick={() => openBoq()}>
                  New BOQ
                </button>
              </div>
            </div>
            {(estate.boqs || []).length > 0 && (
              <ul>
                {(estate.boqs || []).map((b: any) => (
                  <li key={b.id}>
                    <strong>{b.name}</strong>
                    <span className="muted">
                      {' '}
                      · {money((b.lines || []).reduce((s: number, l: any) => s + Number(l.amountCents), 0))}{' '}
                      all stages
                    </span>{' '}
                    <button type="button" className="btn secondary" style={{ padding: '0.1rem 0.4rem' }} onClick={() => openBoq(b)}>
                      Edit
                    </button>{' '}
                    <button type="button" className="btn secondary" style={{ padding: '0.1rem 0.4rem' }} onClick={() => removeBoq(b)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {boqDraft && (
              <div style={{ marginTop: '0.75rem' }}>
                <label className="form">
                  BOQ name
                  <input
                    value={boqDraft.name}
                    placeholder="e.g. Cottage house"
                    onChange={(e) => setBoqDraft({ ...boqDraft, name: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginTop: '0.5rem' }}
                  aria-expanded={boqLinesOpen}
                  onClick={() => setBoqLinesOpen((open) => !open)}
                >
                  {boqLinesOpen ? '▾ Hide lines' : '▸ Show lines'}
                </button>
                {boqLinesOpen && (
                <>
                <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Description</th>
                        <th style={{ width: 140 }}>Amount (US$)</th>
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {boqDraft.lines.map((line, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              value={line.sectionName}
                              placeholder="e.g. Setting Out to Slab"
                              onChange={(e) =>
                                setBoqDraft({
                                  ...boqDraft,
                                  lines: boqDraft.lines.map((l, idx) =>
                                    idx === i ? { ...l, sectionName: e.target.value } : l,
                                  ),
                                })
                              }
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>
                            <input
                              value={line.stageName}
                              placeholder="e.g. Land Clearing"
                              onChange={(e) =>
                                setBoqDraft({
                                  ...boqDraft,
                                  lines: boqDraft.lines.map((l, idx) =>
                                    idx === i ? { ...l, stageName: e.target.value } : l,
                                  ),
                                })
                              }
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.amount}
                              onChange={(e) =>
                                setBoqDraft({
                                  ...boqDraft,
                                  lines: boqDraft.lines.map((l, idx) =>
                                    idx === i ? { ...l, amount: e.target.value } : l,
                                  ),
                                })
                              }
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ padding: '0.2rem 0.5rem' }}
                              onClick={() =>
                                setBoqDraft({
                                  ...boqDraft,
                                  lines:
                                    boqDraft.lines.length === 1
                                      ? blankBoqLines()
                                      : boqDraft.lines.filter((_, idx) => idx !== i),
                                })
                              }
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
                  style={{ marginBottom: '0.5rem' }}
                  onClick={() =>
                    setBoqDraft({
                      ...boqDraft,
                      lines: [
                        ...boqDraft.lines,
                        {
                          sectionName: boqDraft.lines.at(-1)?.sectionName || '',
                          stageName: '',
                          sortOrder: boqDraft.lines.length + 1,
                          amount: '',
                        },
                      ],
                    })
                  }
                >
                  + Add line
                </button>
                </>
                )}
                <p className="muted">
                  Full BOQ {money(chargeCents(boqDraft.lines, ''))}. Houses are charged only from
                  their start stage onward.
                </p>
                <div className="row-actions" style={{ gap: 8 }}>
                  <button type="button" className="btn" disabled={saving} onClick={saveBoq}>
                    Save BOQ
                  </button>
                  <button type="button" className="btn secondary" onClick={() => setBoqDraft(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h3>Expenses &amp; borrowings</h3>
            <p className="muted">
              Project expense comes from the labour account. Company expense comes from the profit
              account. Write what each expense was for. Borrowings still come from the labour pot
              and must be repaid.
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
                  <option value="EXPENSE">Expense</option>
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
              {ledgerForm.kind === 'EXPENSE' && (
                <>
                  <label>
                    Expense category
                    <select
                      value={ledgerForm.expenseCategory}
                      onChange={(e) =>
                        setLedgerForm({
                          ...ledgerForm,
                          expenseCategory: e.target.value as 'COMPANY' | 'PROJECT',
                          projectId:
                            e.target.value === 'PROJECT' ? ledgerForm.projectId : '',
                        })
                      }
                    >
                      <option value="COMPANY">Company expense (from profit)</option>
                      <option value="PROJECT">Project expense (from labour)</option>
                    </select>
                  </label>
                  {ledgerForm.expenseCategory === 'PROJECT' && (
                    <label>
                      House / project
                      <select
                        required
                        value={ledgerForm.projectId}
                        onChange={(e) =>
                          setLedgerForm({ ...ledgerForm, projectId: e.target.value })
                        }
                      >
                        <option value="">Select house</option>
                        {(estate.projects || []).map((h: any) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                            {h.client?.name ? ` · ${h.client.name}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label style={{ gridColumn: '1 / -1' }}>
                    What was this expense for?
                    <input
                      required
                      value={ledgerForm.description}
                      onChange={(e) =>
                        setLedgerForm({ ...ledgerForm, description: e.target.value })
                      }
                      placeholder="e.g. Transport for cement, site toilet hire, fuel for generator"
                    />
                  </label>
                  <label>
                    Paid to (optional)
                    <input
                      value={ledgerForm.partyName}
                      onChange={(e) =>
                        setLedgerForm({ ...ledgerForm, partyName: e.target.value })
                      }
                      placeholder="e.g. Cement supplier"
                    />
                  </label>
                </>
              )}
              {ledgerForm.kind !== 'EXPENSE' && (
                <>
                  <label>
                    Person name
                    <input
                      required
                      value={ledgerForm.partyName}
                      onChange={(e) =>
                        setLedgerForm({ ...ledgerForm, partyName: e.target.value })
                      }
                      placeholder="e.g. John (borrower)"
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
                </>
              )}
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
                        {money(x.amountCents)} ·{' '}
                        {x.expenseCategory === 'PROJECT' ? 'Project' : 'Company'}
                        {x.projectName ? ` · ${x.projectName}` : ''}
                        {x.description ? ` · ${x.description}` : ''}
                        {x.partyName ? ` · ${x.partyName}` : ''}{' '}
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

            {(statement?.labourAccount || statement?.companyAccount) && (
              <div style={{ marginTop: '1rem' }}>
                {statement.labourAccount && (
                  <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                    <h4>
                      Labour account DR / CR
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                        Balance {money(statement.labourAccount.balanceCents)}
                      </span>
                    </h4>
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
                        {statement.labourAccount.lines.map((l: any, i: number) => {
                          const quotedLine =
                            l.section === 'CONTRACT' &&
                            String(l.description || '').startsWith('Labour quoted');
                          const discountLine =
                            l.section === 'CONTRACT' &&
                            String(l.description || '').startsWith('Discounts granted');
                          const byQuote = new Map<string, any[]>();
                          if (quotedLine) {
                            for (const h of estate.projects || []) {
                              const quote = h.estateBoq?.name || 'No quotation';
                              const list = byQuote.get(quote) || [];
                              list.push(h);
                              byQuote.set(quote, list);
                            }
                          }
                          const discounted = discountLine
                            ? (estate.projects || []).filter(
                                (h: any) => Number(h.trail?.discountCents || 0) > 0,
                              )
                            : [];
                          return (
                            <Fragment key={`labour-${l.section}-${i}`}>
                              <tr>
                                <td>{l.section}</td>
                                <td>
                                  {quotedLine ? (
                                    <button
                                      type="button"
                                      className="btn secondary"
                                      style={{ padding: '0.15rem 0.5rem' }}
                                      aria-expanded={quotedOpen}
                                      onClick={() => setQuotedOpen((open) => !open)}
                                    >
                                      {quotedOpen ? '▾' : '▸'} {l.description}
                                    </button>
                                  ) : discountLine ? (
                                    <button
                                      type="button"
                                      className="btn secondary"
                                      style={{ padding: '0.15rem 0.5rem' }}
                                      aria-expanded={discountsOpen}
                                      onClick={() => setDiscountsOpen((open) => !open)}
                                    >
                                      {discountsOpen ? '▾' : '▸'} {l.description}
                                    </button>
                                  ) : (
                                    l.description
                                  )}
                                </td>
                                <td>{l.debitCents ? money(l.debitCents) : '—'}</td>
                                <td>{l.creditCents ? money(l.creditCents) : '—'}</td>
                              </tr>
                              {quotedLine &&
                                quotedOpen &&
                                [...byQuote.entries()].map(([quote, houses]) => (
                                  <Fragment key={quote}>
                                    <tr>
                                      <td></td>
                                      <td>
                                        <strong>
                                          {quote} · {houses.length} house{houses.length === 1 ? '' : 's'}
                                        </strong>
                                      </td>
                                      <td></td>
                                      <td>
                                        {money(
                                          houses.reduce(
                                            (sum: number, h: any) =>
                                              sum + Number(h.trail?.labourQuotedCents || 0),
                                            0,
                                          ),
                                        )}
                                      </td>
                                    </tr>
                                    {houses.map((h: any) => (
                                      <tr key={h.id}>
                                        <td></td>
                                        <td style={{ paddingLeft: '1.25rem' }}>
                                          {h.unitNumber}. {h.name}
                                          {h.client?.name ? ` · ${h.client.name}` : ''}
                                        </td>
                                        <td></td>
                                        <td>{money(h.trail?.labourQuotedCents || 0)}</td>
                                      </tr>
                                    ))}
                                  </Fragment>
                                ))}
                              {discountLine && discountsOpen && (
                                <>
                                  <tr>
                                    <td></td>
                                    <td>
                                      <strong>
                                        {discounted.length} house{discounted.length === 1 ? '' : 's'}
                                      </strong>
                                    </td>
                                    <td>
                                      {money(
                                        discounted.reduce(
                                          (sum: number, h: any) =>
                                            sum + Number(h.trail?.discountCents || 0),
                                          0,
                                        ),
                                      )}
                                    </td>
                                    <td></td>
                                  </tr>
                                  {discounted.map((h: any) => (
                                    <tr key={h.id}>
                                      <td></td>
                                      <td style={{ paddingLeft: '1.25rem' }}>
                                        {h.unitNumber}. {h.name}
                                        {h.client?.name ? ` · ${h.client.name}` : ''}
                                        {h.discountReason ? (
                                          <div className="muted">{h.discountReason}</div>
                                        ) : null}
                                      </td>
                                      <td>{money(h.trail?.discountCents || 0)}</td>
                                      <td></td>
                                    </tr>
                                  ))}
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {statement.companyAccount && (
                  <div className="table-wrap">
                    <h4>
                      Company / profit account DR / CR
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                        Balance {money(statement.companyAccount.balanceCents)}
                      </span>
                    </h4>
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
                        {statement.companyAccount.lines.map((l: any, i: number) => (
                          <tr key={`company-${l.section}-${i}`}>
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
            )}
          </div>

          {showAdd && (
            <div ref={addPanelRef} className="panel" style={{ marginBottom: '1rem' }}>
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
                    stages={addStageChoices}
                    value={addForm.catchupStageLabel}
                    onChange={(v) => setAddForm({ ...addForm, catchupStageLabel: v })}
                  />
                </label>
                <label>
                  Stage it is at now
                  <StageSelect
                    stages={addStageChoices}
                    value={addForm.currentStageLabel}
                    emptyLabel="Same as start stage"
                    onChange={(v) => setAddForm({ ...addForm, currentStageLabel: v })}
                  />
                </label>
                <label>
                  Stage BOQ
                  <select
                    value={addForm.estateBoqId}
                    onChange={(e) => setAddForm({ ...addForm, estateBoqId: e.target.value })}
                  >
                    <option value="">No BOQ (use labour amount below)</option>
                    {(estate.boqs || []).map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Labour quoted
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addForm.estateBoqId ? String((addCharge || 0) / 100) : addForm.labourQuoted}
                    readOnly={!!addForm.estateBoqId}
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
            <div
              ref={managePanelRef}
              className="panel"
              style={{ marginBottom: '1rem', border: '2px solid #b45309' }}
            >
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
                    readOnly={!!managing.boqStages?.length}
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
                    stages={manageStageChoices}
                    value={form.startStage}
                    onChange={(v) => setForm({ ...form, startStage: v })}
                  />
                </label>
                <label>
                  Stage it is at now
                  <StageSelect
                    stages={manageStageChoices}
                    value={form.currentStage}
                    onChange={(v) => setForm({ ...form, currentStage: v })}
                  />
                  <StageCompletion
                    stage={form.currentStage}
                    templates={templates}
                    quoteStages={manageStageChoices.map((stage) =>
                      typeof stage === 'string' ? stage : stage.value,
                    )}
                  />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="muted">
                    Current trail: quoted {money(managing.trail.labourQuotedCents)} − discount{' '}
                    {money(managing.trail.discountCents)}
                    {managing.trail.buildingMatchDiscountCents
                      ? ` − building match ${money(managing.trail.buildingMatchDiscountCents)}`
                      : ''}{' '}
                    = net {money(managing.trail.netDueCents)}. Owes{' '}
                    {money(managing.trail.clientOwesCents)}.
                    {managing.estateBoq?.name ? ` Quotation: ${managing.estateBoq.name}.` : ''}
                  </p>
                  {managing.estateBoq?.name && (
                    <p>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={saving}
                        onClick={clearHouseBoq}
                      >
                        Remove quotation from this house
                      </button>
                    </p>
                  )}
                  {!!managing.boqStages?.length && (
                    <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Section / description</th>
                            <th>Amount</th>
                            <th>Charge</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managing.boqStages.map((s: any) => (
                          <tr key={`${s.sectionName}-${s.stageName}-${s.sortOrder}`}>
                            <td>
                              {s.sectionName ? `${s.sectionName} · ` : ''}
                              {s.stageName}
                            </td>
                              <td>{money(s.amountCents)}</td>
                              <td>{s.included ? 'Charged' : 'Not charged (before start)'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
              <div className="grid grid-4">
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
                <div>
                  <div className="muted">Average completion</div>
                  <strong>
                    {stageReport.summary.averageCompletionPercent != null
                      ? `${stageReport.summary.averageCompletionPercent}%`
                      : 'Not enough data'}
                  </strong>
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
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    downloadFile(
                      `/estates/${id}/stage-report/export?format=pdf`,
                      `${estate.code}-stages.pdf`,
                    ).catch((e) => setError(e.message))
                  }
                >
                  Export stage report PDF
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
            <div className="form grid grid-2">
              <label>
                Start stage (when received)
                <StageSelect
                  keepOption
                  stages={stageChoices}
                  value={bulkStage.start}
                  emptyLabel="Clear (not set)"
                  onChange={(v) => setBulkStage({ ...bulkStage, start: v })}
                />
              </label>
              <label>
                Current stage (now)
                <StageSelect
                  keepOption
                  stages={stageChoices}
                  value={bulkStage.current}
                  emptyLabel="Clear (not set)"
                  onChange={(v) => setBulkStage({ ...bulkStage, current: v })}
                />
              </label>
              <div>
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
              Houses are grouped by the quotation applied to them. Tick houses, choose the
              quotation above, then apply. Click Manage to rename a house, set the owner, change
              stages, or grant an individual discount.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <label style={{ maxWidth: 360, flex: '1 1 220px' }}>
                Search by name
                <input
                  value={houseQuery}
                  placeholder="House or owner name"
                  onChange={(e) => setHouseQuery(e.target.value)}
                />
              </label>
              <label style={{ maxWidth: 280, flex: '1 1 180px' }}>
                Quotation
                <select value={quoteFilter} onChange={(e) => setQuoteFilter(e.target.value)}>
                  <option value="">All quotations</option>
                  {quotationFilters.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {(quoteFilter || houseQuery.trim()) && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setQuoteFilter('');
                      setHouseQuery('');
                    }}
                  >
                    Remove filter
                  </button>
                </div>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all houses"
                        checked={
                          visibleHouses.length > 0 &&
                          visibleHouses.every((h: any) => selected.includes(h.id))
                        }
                        onChange={(e) => {
                          const ids = visibleHouses.map((h: any) => h.id);
                          setSelected((prev) =>
                            e.target.checked
                              ? [...new Set([...prev, ...ids])]
                              : prev.filter((id) => !ids.includes(id)),
                          );
                        }}
                      />
                    </th>
                    <th>#</th>
                    <th>House / Owner</th>
                    <th>Start stage</th>
                    <th>Current stage</th>
                    <th>Complete</th>
                    <th>BOQ</th>
                    <th>Quoted</th>
                    <th>Discount</th>
                    <th>Building match</th>
                    <th>Net due</th>
                    <th>Cash in</th>
                    <th>Owes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHouses.length === 0 && (
                    <tr>
                      <td colSpan={14} className="muted">
                        No house matches.
                      </td>
                    </tr>
                  )}
                  {houseGroups.map((group) => (
                    <Fragment key={group.name}>
                      <tr>
                        <td colSpan={14} style={{ background: '#f6f3ee' }}>
                          <strong>{group.name}</strong>
                          <span className="muted">
                            {' '}
                            · {group.houses.length} house{group.houses.length === 1 ? '' : 's'}
                          </span>
                        </td>
                      </tr>
                      {group.houses.map((h: any) => (
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
                      <td>
                        {resolveQuoteStage(h.catchupStageLabel, quoteStages) || (
                          <span className="muted">Not set</span>
                        )}
                      </td>
                      <td>
                        {resolveQuoteStage(h.currentStageLabel, quoteStages) || (
                          <span className="muted">Not set</span>
                        )}
                      </td>
                      <td>
                        <StageCompletion
                          stage={resolveQuoteStage(h.currentStageLabel, quoteStages)}
                          templates={templates}
                          quoteStages={
                            h.boqStages?.length
                              ? quoteStageOptions([{ lines: h.boqStages }]).map((stage) => stage.value)
                              : quoteStages
                          }
                        />
                      </td>
                      <td>{h.estateBoq?.name || <span className="muted">None</span>}</td>
                      <td>{money(h.trail.labourQuotedCents)}</td>
                      <td>
                        {money(h.trail.discountCents)}
                        {h.discountReason ? (
                          <div className="muted">{h.discountReason}</div>
                        ) : null}
                      </td>
                      <td>{money(h.trail.buildingMatchDiscountCents || 0)}</td>
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
                    </Fragment>
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
