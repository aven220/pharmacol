import { useEffect, useState } from 'react';
import {
  fetchAlertasSanitarias,
  fetchAlertasSyncCuota,
  getErrorMessage,
  syncAlertasPortal,
  triggerSync,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Alerta = {
  id: string;
  numeroAlerta: string;
  fechaAlerta: string;
  titulo: string;
  descripcion: string;
  fuenteAlerta?: string;
  tipoDocumento?: string;
  documentoUrl?: string;
  categoriaProducto?: string;
  canalOrigen?: string;
};

type SyncCuota = {
  ilimitado: boolean;
  max: number | null;
  usado: number;
  restante: number | null;
};

const CATEGORIA_LABEL: Record<string, string> = {
  medicamentos: 'Medicamentos',
  alimentos: 'Alimentos',
  cosmeticos: 'Cosméticos',
  dispositivos: 'Dispositivos',
  general: 'General',
};

function formatSyncMessage(result: Record<string, unknown>): string {
  const inserted = Number(result.inserted ?? result.registrosInsertados ?? 0);
  const updated = Number(result.updated ?? result.registrosActualizados ?? 0);
  const read = Number(result.read ?? result.registrosLeidos ?? 0);
  const persisted = result.persisted !== false;

  if (!persisted && inserted === 0 && updated === 0) {
    return `Sin alertas nuevas (${read} revisadas en el portal). No se guardó registro en historial.`;
  }

  return `Portal INVIMA: ${read} revisadas, ${inserted} nuevas, ${updated} actualizadas`;
}

export default function AlertasSanitariasPage() {
  const { can } = useAuth();
  const isAdminSync = can('sync:execute');
  const canRegenteSync = can('alertas:sync');

  const [items, setItems] = useState<Alerta[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Alerta | null>(null);
  const [page, setPage] = useState(1);
  const [cuota, setCuota] = useState<SyncCuota | null>(null);

  async function loadCuota() {
    if (!canRegenteSync || isAdminSync) return;
    try {
      const data = await fetchAlertasSyncCuota();
      setCuota(data);
    } catch {
      setCuota(null);
    }
  }

  async function load(term = searchTerm, p = page) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAlertasSanitarias(term, p);
      setItems(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
    loadCuota().catch(console.error);
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearchTerm(q);
    load(q, 1).catch(console.error);
  }

  async function onSyncRegente() {
    if (cuota && !cuota.ilimitado && (cuota.restante ?? 0) <= 0) {
      setMessage(`Límite diario alcanzado (${cuota.max} sincronizaciones por día).`);
      return;
    }

    setSyncing(true);
    setMessage('Sincronizando alertas del portal INVIMA…');
    setError(null);
    try {
      const result = await syncAlertasPortal();
      setMessage(formatSyncMessage(result as Record<string, unknown>));
      await Promise.all([load(), loadCuota()]);
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  async function onSyncPortalAdmin() {
    setSyncing(true);
    setMessage('Sincronizando portal INVIMA (hoy)…');
    setError(null);
    try {
      const result = await triggerSync('INVIMA_ALERTAS_PORTAL');
      setMessage(formatSyncMessage(result as Record<string, unknown>));
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  async function onSyncAllAdmin() {
    setSyncing(true);
    setMessage('Sincronizando portal + datos.gov.co…');
    setError(null);
    try {
      const portal = await triggerSync('INVIMA_ALERTAS_PORTAL');
      const datos = await triggerSync('INVIMA_ALERTAS_SANITARIAS');
      setMessage(
        `Portal: +${portal.inserted ?? portal.registrosInsertados ?? 0} nuevas | ` +
          `Datos.gov: +${datos.inserted ?? datos.registrosInsertados ?? 0} nuevas`,
      );
      await load();
    } catch (e) {
      setMessage(getErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const regenteSinCuota = Boolean(
    canRegenteSync && !isAdminSync && cuota && !cuota.ilimitado && (cuota.restante ?? 0) <= 0,
  );

  return (
    <div>
      <h2>Alertas Sanitarias INVIMA</h2>
      <p style={{ fontSize: 14, color: '#666' }}>
        Fuente principal: <strong>app.invima.gov.co/alertas</strong> (alertas del día).
        {isAdminSync ? ' Como administrador puedes ejecutar sync completo desde aquí o en Sincronización.' : null}
      </p>

      {error ? (
        <p style={{ background: '#ffebee', padding: 12, borderRadius: 8, color: '#c62828' }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p style={{ background: '#e8f4f6', padding: 12, borderRadius: 8 }}>{message}</p>
      ) : null}

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            type="search"
            placeholder="Buscar por producto, número o descripción…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="submit" className="btn" disabled={loading}>
            Buscar
          </button>
        </form>

        {isAdminSync ? (
          <>
            <button type="button" className="btn" disabled={syncing} onClick={onSyncPortalAdmin}>
              {syncing ? 'Sincronizando…' : 'Sync portal (hoy)'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: '#1565c0' }}
              disabled={syncing}
              onClick={onSyncAllAdmin}
            >
              Sync completo
            </button>
          </>
        ) : null}

        {canRegenteSync && !isAdminSync ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <button
              type="button"
              className="btn"
              disabled={syncing || regenteSinCuota}
              onClick={onSyncRegente}
            >
              {syncing ? 'Sincronizando…' : 'Actualizar alertas'}
            </button>
            {cuota && !cuota.ilimitado ? (
              <span style={{ fontSize: 12, color: regenteSinCuota ? '#c62828' : '#666' }}>
                {cuota.restante} de {cuota.max} sincronizaciones restantes hoy
              </span>
            ) : null}
          </div>
        ) : null}

        <span style={{ fontSize: 13, color: '#666' }}>{total} alerta(s) en total</span>
      </div>

      <div className="card">
        {loading && !items.length ? <p>Cargando…</p> : null}
        {!loading && !items.length ? (
          <p>
            No hay alertas cargadas.
            {canRegenteSync || isAdminSync ? (
              <>
                {' '}
                Pulsa <strong>Actualizar alertas</strong> o pide a un administrador que sincronice el catálogo.
              </>
            ) : null}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Fecha</th>
                <th>Producto / título</th>
                <th>Categoría</th>
                <th>Origen</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(a)}
                >
                  <td>{a.numeroAlerta}</td>
                  <td>{String(a.fechaAlerta).slice(0, 10)}</td>
                  <td>{a.titulo.slice(0, 80)}{a.titulo.length > 80 ? '…' : ''}</td>
                  <td>{CATEGORIA_LABEL[a.categoriaProducto ?? ''] ?? a.categoriaProducto ?? '—'}</td>
                  <td>
                    {a.canalOrigen === 'PORTAL' ? (
                      <span style={{ color: '#2e7d32', fontWeight: 600 }}>Portal</span>
                    ) : (
                      'Datos.gov'
                    )}
                  </td>
                  <td>
                    {a.documentoUrl ? (
                      <a href={a.documentoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Ver
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                load(searchTerm, p).catch(console.error);
              }}
            >
              Anterior
            </button>
            <span style={{ alignSelf: 'center', fontSize: 13 }}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                load(searchTerm, p).catch(console.error);
              }}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div
          className="card"
          style={{ marginTop: 16, borderLeft: '4px solid #c62828' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <h3 style={{ margin: 0 }}>Alerta {selected.numeroAlerta}</h3>
            <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#666' }}>
            {String(selected.fechaAlerta).slice(0, 10)}
            {selected.categoriaProducto
              ? ` · ${CATEGORIA_LABEL[selected.categoriaProducto] ?? selected.categoriaProducto}`
              : ''}
            {selected.canalOrigen === 'PORTAL' ? ' · Portal INVIMA' : ' · Datos.gov.co'}
            {selected.tipoDocumento ? ` · ${selected.tipoDocumento}` : ''}
          </p>
          <p><strong>{selected.titulo}</strong></p>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{selected.descripcion}</p>
          {selected.documentoUrl ? (
            <p>
              <a href={selected.documentoUrl} target="_blank" rel="noreferrer">
                Abrir documento oficial INVIMA (PDF)
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
