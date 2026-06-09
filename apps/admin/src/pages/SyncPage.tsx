import { useEffect, useRef, useState } from 'react';
import {
  cancelSyncJob,
  deleteSyncJob,
  fetchFuentes,
  fetchSyncHistory,
  getErrorMessage,
  triggerSync,
} from '../api/client';

type SyncJob = {
  id: string;
  status: string;
  registrosLeidos?: number;
  registrosInsertados?: number;
  registrosActualizados?: number;
  registrosOmitidos?: number;
  createdAt?: string;
  fuente?: { codigo?: string };
  metadata?: { canceladoPorAdmin?: boolean };
};

export default function SyncPage() {
  const [history, setHistory] = useState<{ items: SyncJob[] } | null>(null);
  const [fuentes, setFuentes] = useState<Array<{ codigo: string; nombre: string; activo: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [h, f] = await Promise.all([fetchSyncHistory(), fetchFuentes()]);
      setHistory(h);
      setFuentes(Array.isArray(f) ? f : []);
      const inProgress = (h.items ?? []).some((j: SyncJob) => j.status === 'EN_PROCESO');
      if (inProgress && !pollRef.current) {
        pollRef.current = setInterval(() => {
          fetchSyncHistory().then(setHistory).catch(console.error);
        }, 5000);
      } else if (!inProgress && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      setLoadError(getErrorMessage(e));
    }
  }

  useEffect(() => {
    load().catch(console.error);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function runSync(codigo: string, force = false) {
    setLoading(true);
    setMessage(
      force
        ? `Reimportando ${codigo} (forzado)…`
        : `Sincronizando ${codigo}… Los contadores se actualizan cada 1000 registros.`,
    );
    try {
      const result = await triggerSync(codigo, force);
      setMessage(
        `Completado: ${result.read ?? result.registrosLeidos ?? 0} leídos, ` +
          `${result.inserted ?? result.registrosInsertados ?? 0} insertados, ` +
          `${result.updated ?? result.registrosActualizados ?? 0} actualizados, ` +
          `${result.skipped ?? result.registrosOmitidos ?? 0} omitidos`,
      );
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(job: SyncJob) {
    if (!window.confirm('¿Cancelar esta sincronización?')) return;
    setActionId(job.id);
    try {
      await cancelSyncJob(job.id);
      setMessage('Sincronización cancelada.');
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(job: SyncJob) {
    if (!window.confirm('¿Eliminar este registro del historial?')) return;
    setActionId(job.id);
    try {
      await deleteSyncJob(job.id);
      setMessage('Registro eliminado.');
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setActionId(null);
    }
  }

  function statusLabel(job: SyncJob) {
    if (job.metadata?.canceladoPorAdmin) return 'CANCELADA';
    return job.status;
  }

  return (
    <div>
      <h2>Sincronización INVIMA</h2>
      {loadError ? (
        <p style={{ background: '#ffebee', padding: 12, borderRadius: 8, color: '#c62828' }}>
          Error cargando datos: {loadError}
        </p>
      ) : null}
      {message ? <p style={{ background: '#e8f4f6', padding: 12, borderRadius: 8 }}>{message}</p> : null}
      <div className="card">
        <h3>Fuentes activas</h3>
        <p style={{ fontSize: 13, color: '#666' }}>
          Para <strong>medicamentos</strong> usa <code>INVIMA_CUM_VIGENTES</code>.
          Omitidos altos en re-sync es normal (ya existían). Insertados 0 en dispositivos = bug corregido → usa Reimportar.
        </p>
        {!loadError && fuentes.filter((f) => f.activo).length === 0 ? (
          <p style={{ color: '#e65100', fontSize: 13 }}>
            No hay fuentes activas en la BD. En el servidor ejecuta:{' '}
            <code>bash scripts/seed-fuentes.sh</code>
          </p>
        ) : null}
        {fuentes.filter((f) => f.activo).map((f) => (
          <div key={f.codigo} style={{ marginBottom: 12 }}>
            <strong>{f.nombre}</strong> ({f.codigo})
            <button
              className="btn"
              style={{ marginLeft: 12 }}
              disabled={loading}
              onClick={() => runSync(f.codigo)}
            >
              {loading ? 'Sincronizando…' : 'Ejecutar'}
            </button>
            {f.codigo === 'INVIMA_DISPOSITIVOS' || f.codigo === 'INVIMA_CUM_VIGENTES' ? (
              <button
                className="btn"
                style={{ marginLeft: 8, background: '#e65100' }}
                disabled={loading}
                onClick={() => runSync(f.codigo, true)}
              >
                Reimportar
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Historial</h3>
        <table>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Estado</th>
              <th>Leídos</th>
              <th>Insertados</th>
              <th>Actualizados</th>
              <th>Omitidos</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(history?.items ?? []).map((j) => {
              const busy = actionId === j.id;
              const canCancel = j.status === 'EN_PROCESO' || j.status === 'PENDIENTE';
              const canDelete = j.status !== 'EN_PROCESO';
              return (
                <tr key={j.id}>
                  <td>{j.fuente?.codigo ?? '—'}</td>
                  <td>
                    {statusLabel(j)}
                    {j.status === 'EN_PROCESO' ? ' ⏳' : ''}
                  </td>
                  <td>{j.registrosLeidos ?? 0}</td>
                  <td>{j.registrosInsertados ?? 0}</td>
                  <td>{j.registrosActualizados ?? 0}</td>
                  <td>{j.registrosOmitidos ?? 0}</td>
                  <td>{String(j.createdAt ?? '').slice(0, 19)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canCancel ? (
                      <button
                        className="btn btn-sm btn-warn"
                        disabled={busy}
                        onClick={() => handleCancel(j)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ marginLeft: canCancel ? 6 : 0 }}
                        disabled={busy}
                        onClick={() => handleDelete(j)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
