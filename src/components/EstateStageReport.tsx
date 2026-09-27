'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/components/LoadingState';
import { api, downloadFile } from '@/lib/api';

function stageBreakdown(list: { stage: string; houses: number }[]) {
  return list.map((s) => `${s.stage}: ${s.houses}`).join(', ');
}

export function EstateStageReport({ initialEstateId = '' }: { initialEstateId?: string }) {
  const [overview, setOverview] = useState<any>(null);
  const [estateId, setEstateId] = useState(initialEstateId);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/estates/stage-report')
      .then(setOverview)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (initialEstateId) setEstateId(initialEstateId);
  }, [initialEstateId]);

  useEffect(() => {
    if (!estateId) {
      setReport(null);
      return;
    }
    setBusy(true);
    setError('');
    api(`/estates/${estateId}/stage-report`)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [estateId]);

  const estates = overview?.estates || [];

  return (
    <div className="panel" id="stages" style={{ marginTop: '1rem' }}>
      <h3>Estate stage report</h3>
      <p className="muted">
        Where each house was when we received it, where it is now, and who owns it. The compiled
        table rolls this up per estate.
      </p>
      {error && <p className="error">{error}</p>}

      {!overview && !error && <LoadingState label="Loading stage report…" compact />}
      {overview && (
        <div className="table-wrap">
          <h4>Compiled: all estates</h4>
          <table>
            <thead>
              <tr>
                <th>Estate</th>
                <th>Houses</th>
                <th>Moved forward</th>
                <th>Avg stages advanced</th>
                <th>Where houses are now</th>
                <th>Where we started</th>
              </tr>
            </thead>
            <tbody>
              {estates.map((e: any) => (
                <tr
                  key={e.id}
                  style={{
                    cursor: 'pointer',
                    background: estateId === e.id ? 'rgba(180, 83, 9, 0.08)' : undefined,
                  }}
                  onClick={() => setEstateId(e.id)}
                >
                  <td>
                    <strong>{e.name}</strong>
                    <div className="muted">{e.code}</div>
                  </td>
                  <td>{e.summary.houseCount}</td>
                  <td>{e.summary.progressedHouses}</td>
                  <td>{e.summary.averageStagesAdvanced ?? 'Not enough data'}</td>
                  <td>{stageBreakdown(e.summary.byCurrentStage)}</td>
                  <td>{stageBreakdown(e.summary.byStartStage)}</td>
                </tr>
              ))}
              {!estates.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No estates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <label style={{ marginTop: '1rem', display: 'block', maxWidth: 420 }}>
        House-by-house report for
        <select value={estateId} onChange={(e) => setEstateId(e.target.value)}>
          <option value="">Select estate…</option>
          {estates.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.code} · {e.name}
            </option>
          ))}
        </select>
      </label>

      {busy && <LoadingState label="Loading houses…" compact />}
      {report && !busy && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                downloadFile(
                  `/estates/${report.estate.id}/stage-report/export`,
                  `${report.estate.code}-stages.csv`,
                ).catch((e) => setError(e.message))
              }
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                downloadFile(
                  `/estates/${report.estate.id}/stage-report/export?format=pdf`,
                  `${report.estate.code}-stages.pdf`,
                ).catch((e) => setError(e.message))
              }
            >
              Export PDF
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>House</th>
                  <th>Owner</th>
                  <th>Start stage</th>
                  <th>Current stage</th>
                  <th>Stages advanced</th>
                  <th>Stage updated</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r: any) => (
                  <tr key={r.projectId}>
                    <td>{r.unitNumber}</td>
                    <td>
                      <strong>{r.houseName}</strong>
                      <div className="muted">{r.code}</div>
                    </td>
                    <td>
                      {r.ownerName}
                      {r.ownerPhone && !r.ownerPhone.startsWith('pending-') ? (
                        <div className="muted">{r.ownerPhone}</div>
                      ) : null}
                    </td>
                    <td>{r.startStage || <span className="muted">Not set</span>}</td>
                    <td>{r.currentStage || <span className="muted">Not set</span>}</td>
                    <td>{r.stagesAdvanced ?? <span className="muted">n/a</span>}</td>
                    <td>
                      {r.currentStageUpdatedAt
                        ? new Date(r.currentStageUpdatedAt).toLocaleDateString()
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
