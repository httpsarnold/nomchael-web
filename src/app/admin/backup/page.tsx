'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { LoadingState } from '@/components/LoadingState';
import { api, downloadFile, getUser } from '@/lib/api';

type Preview = {
  createdAt: string;
  tableCount: number;
  totalRows: number;
  tables: { table: string; rowCount: number }[];
};

export default function BackupPage() {
  const user = getUser();
  const allowed =
    user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGING_DIRECTOR';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setPreview(await api<Preview>('/backup/preview'));
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [allowed]);

  async function createBackup() {
    setError('');
    setBusy(true);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      await downloadFile('/backup/database', `nomchael-backup-${stamp}.json`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1>Database backup</h1>
      <p className="muted">
        Download a full JSON snapshot of every table. Keep the file offline — it includes user
        password hashes and business data.
      </p>

      {!allowed && (
        <p className="error">Only Super Admin or Managing Director can create backups.</p>
      )}
      {error && <p className="error">{error}</p>}
      {allowed && loading && <LoadingState label="Checking database…" />}

      {allowed && !loading && preview && (
        <div className="grid grid-2" style={{ marginTop: '1rem' }}>
          <div className="panel">
            <h3>Create backup</h3>
            <p className="muted" style={{ marginBottom: '1rem' }}>
              {preview.tableCount} tables · {preview.totalRows.toLocaleString()} rows
            </p>
            <button type="button" className="btn" disabled={busy} onClick={createBackup}>
              {busy ? 'Preparing backup…' : 'Download backup'}
            </button>
            <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
              Store this file somewhere safe (drive, encrypted folder). Restore from backup can be
              added next if you need it.
            </p>
          </div>

          <div className="panel">
            <h3>Tables</h3>
            <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Table</th>
                    <th style={{ textAlign: 'right' }}>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.tables.map((t) => (
                    <tr key={t.table}>
                      <td>{t.table}</td>
                      <td style={{ textAlign: 'right' }}>{t.rowCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
