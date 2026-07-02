import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../api/axios';
import { SEO } from '../components/SEO';
import Alert from '../components/Alert';

export function Admin() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    document.title = 'Admin Panel — MediStock';
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get('/admin/logs?limit=100');
        setLogs(data.data || []);
      } catch (err) {
        console.error('Failed to load audit logs', err);
        setError(err?.response?.data?.message || 'Unable to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return logs;
    return logs.filter((log) =>
      [log.action, log.target, log.userEmail, log.user?.name, log.ip, JSON.stringify(log.details)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [filter, logs]);

  return (
    <div className="space-y-8">
      <SEO title="Admin — MediStock" description="Manage audit logs and admin activity for MediStock." url="/admin" />
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Activity logs & system audit</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Review recent admin actions, API activity, and audit events for security and compliance.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-4 text-sm text-muted-foreground">
            Admin-only view for account and audit oversight.
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Audit logs</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent user and system activity</h2>
          </div>
          <div className="flex w-full max-w-sm items-center gap-3 rounded-3xl border border-border bg-background px-4 py-3">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter logs"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {error && <Alert type="danger">{error}</Alert>}

        <div className="mt-6 overflow-x-auto rounded-[2rem] border border-border bg-white">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-background/80 text-slate-500">
              <tr>
                <th className="px-4 py-4 font-medium">When</th>
                <th className="px-4 py-4 font-medium">User</th>
                <th className="px-4 py-4 font-medium">Action</th>
                <th className="px-4 py-4 font-medium">Target</th>
                <th className="px-4 py-4 font-medium">IP</th>
                <th className="px-4 py-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading audit logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No activity found.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <React.Fragment key={log._id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedLogId(expandedLogId === log._id ? null : log._id)}
                    >
                      <td className="px-4 py-4 text-slate-700">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-4 text-slate-600">{log.user?.name || log.userEmail || 'System'}</td>
                      <td className="px-4 py-4 text-slate-600">
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 border border-sky-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{log.target || 'N/A'}</td>
                      <td className="px-4 py-4 text-slate-600 font-mono text-xs">{log.ip}</td>
                      <td className="px-4 py-4 text-slate-600 max-w-[18rem]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate block font-mono text-xs bg-slate-50 p-1 rounded border border-slate-100 flex-1">
                            {JSON.stringify(log.details || {})}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline shrink-0"
                          >
                            {expandedLogId === log._id ? 'Hide' : 'View'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedLogId === log._id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Audit Payload</p>
                            <pre className="text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap font-mono p-3 bg-slate-50 rounded-xl border">
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
