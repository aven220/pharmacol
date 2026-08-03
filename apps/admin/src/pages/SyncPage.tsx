import { useEffect, useRef, useState } from 'react';
import {
  cancelSyncJob,
  deleteSyncJob,
  fetchSyncErrors,
  fetchFuentes,
  fetchSyncHistory,
  getErrorMessage,
  resetStuckSyncJobs,
  triggerSync,
} from '../api/client';

type SyncJob = {
  id: string;
  status: string;
  registrosLeidos?: number;
  registrosInsertados?: number;
  registrosActualizados?: number;
  registrosOmitidos?: number;
  registrosError?: number;
  createdAt?: string;
  fuente?: { codigo?: string };
  metadata?: { canceladoPorAdmin?: boolean; errorMensaje?: string; errores?: number; nota?: string; sinCambiosNuevos?: boolean };
};

type SyncErrorRow = {
  filaNumero?: number;
  errorMensaje?: string;
  valor?: string;
};

export default function SyncPage() {
  const [history, setHistory] = useState<{ items: SyncJob[] } | null>(null);
  const [fuentes, setFuentes] = useState<Array<{ codigo: string; nombre: string; activo: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedErrors, setSelectedErrors] = useState<SyncErrorRow[] | null>(null);
  const [errorsTitle, setErrorsTitle] = useState<string>('');
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
          `${result.skipped ?? result.registrosOmitidos ?? 0} omitidos` +
          (result.persisted === false && (result.read ?? 0) > 0
            ? ' (terminó pero no se guardó en historial)'
            : ''),
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

  async function handleViewErrors(job: SyncJob) {
    setActionId(`errors-${job.id}`);
    try {
      const data = await fetchSyncErrors(job.id, 50);
      setSelectedErrors(Array.isArray(data.items) ? data.items : []);
      setErrorsTitle(`${job.fuente?.codigo ?? 'SYNC'} — ${job.registrosError ?? 0} error(es)`);
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setActionId(null);
    }
  }

  function statusLabel(job: SyncJob) {
    if (job.metadata?.canceladoPorAdmin) return 'CANCELADA';
    if (job.status === 'COMPLETADA' && (job.metadata as { sinCambiosNuevos?: boolean })?.sinCambiosNuevos) {
      return 'COMPLETADA (verificada, sin cambios)';
    }
    if (job.status === 'COMPLETADA' && job.metadata?.errores) {
      return `COMPLETADA (${job.metadata.errores} error(es) menor(es))`;
    }
    if (job.status === 'FALLIDA' && job.metadata?.errorMensaje) {
      return `FALLIDA — ${job.metadata.errorMensaje}`;
    }
    return job.status;
  }

  async function handleResetStuck() {
    setActionId('reset');
    try {
      const r = await resetStuckSyncJobs();
      setMessage(`Syncs colgadas liberadas: ${r.cleared ?? 0}. Ya puede ejecutar INVIMA_CUM_VIGENTES.`);
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setActionId(null);
    }
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
          Fuentes útiles:
          <br />• <code>INVIMA_CUM_VIGENTES</code> — medicamentos (puede reportar errores menores
          por filas incompletas; si el % de error es bajo, la base queda usable).
          <br />• <code>INVIMA_DISPOSITIVOS</code> — dispositivos médicos (hay que ejecutarla
          aparte; sin esta sync la búsqueda de DM queda vacía).
          <br />• <code>INVIMA_ALERTAS_PORTAL</code> / <code>INVIMA_ALERTAS_SANITARIAS</code> —
          alertas.
          <br />
          <strong>Token INVIMA es opcional</strong>. Si una sync no arranca, use &quot;Liberar
          colgadas&quot;. Omitidos altos en re-sync es normal.
        </p>
        <button
          type="button"
          className="btn"
          style={{ marginBottom: 16, background: '#5c6bc0' }}
          disabled={loading || actionId === 'reset'}
          onClick={() => handleResetStuck()}
        >
          {actionId === 'reset' ? 'Liberando…' : 'Liberar syncs colgadas'}
        </button>
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
        <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
          Nota: la fuente de vencidos (<code>INVIMA_CUM_VENCIDOS</code>) esta desactivada porque INVIMA retiró
          ese dataset. Hoy la base oficial vigente ya incluye CUM activos e inactivos.
        </p>
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
              <th>Errores</th>
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
                  <td>{j.registrosError ?? 0}</td>
                  <td>{String(j.createdAt ?? '').slice(0, 19)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(j.registrosError ?? 0) > 0 ? (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#455a64', marginRight: 6 }}
                        disabled={busy}
                        onClick={() => handleViewErrors(j)}
                      >
                        Ver errores
                      </button>
                    ) : null}
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
        {selectedErrors ? (
          <div style={{ marginTop: 14, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{errorsTitle}</strong>
              <button className="btn btn-sm" style={{ background: '#78909c' }} onClick={() => setSelectedErrors(null)}>
                Cerrar
              </button>
            </div>
            {selectedErrors.length === 0 ? (
              <p style={{ fontSize: 13, color: '#666' }}>No hay filas de error guardadas para este job.</p>
            ) : (
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Error</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedErrors.map((er, idx) => (
                    <tr key={`${er.filaNumero ?? idx}-${idx}`}>
                      <td>{er.filaNumero ?? '—'}</td>
                      <td>{er.errorMensaje ?? 'Error desconocido'}</td>
                      <td style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {er.valor ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
