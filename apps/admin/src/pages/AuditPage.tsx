import { useEffect, useState } from 'react';
import { fetchActividadConsultas, fetchAudit } from '../api/client';

const ACCION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  REGISTER: 'Registro',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  SYNC_MANUAL: 'Sync manual',
  SYNC_ALERTAS: 'Sync alertas (regente)',
  OCR_ANALYZE: 'Análisis OCR',
  IA_IDENTIFY: 'Identificación IA',
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('es-CO');
}

type Tab = 'acciones' | 'consultas';

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>('acciones');
  const [audit, setAudit] = useState<{ items: Array<Record<string, unknown>> } | null>(null);
  const [consultas, setConsultas] = useState<{ items: Array<Record<string, unknown>> } | null>(null);

  useEffect(() => {
    fetchAudit().then(setAudit).catch(console.error);
    fetchActividadConsultas().then(setConsultas).catch(console.error);
  }, []);

  return (
    <div>
      <h2>Actividad de usuarios</h2>
      <p className="consulta-intro">
        Registro de inicios de sesión, registros y consultas realizadas en el catálogo INVIMA.
      </p>

      <div className="login-tabs" style={{ marginBottom: 16, maxWidth: 420 }}>
        <button
          type="button"
          className={tab === 'acciones' ? 'login-tab login-tab-active' : 'login-tab'}
          onClick={() => setTab('acciones')}
        >
          Acciones del sistema
        </button>
        <button
          type="button"
          className={tab === 'consultas' ? 'login-tab login-tab-active' : 'login-tab'}
          onClick={() => setTab('consultas')}
        >
          Consultas realizadas
        </button>
      </div>

      {tab === 'acciones' ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Recurso</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {(audit?.items ?? []).map((log) => (
                <tr key={String(log.id)}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{String((log.user as { email?: string })?.email ?? '—')}</td>
                  <td>{ACCION_LABELS[String(log.accion)] ?? String(log.accion)}</td>
                  <td>{String(log.recurso ?? '—')}</td>
                  <td>{String(log.ipAddress ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Búsqueda</th>
              </tr>
            </thead>
            <tbody>
              {(consultas?.items ?? []).map((row) => (
                <tr key={String(row.id)}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{String((row.user as { email?: string })?.email ?? '—')}</td>
                  <td>{String(row.tipoBusqueda ?? '—')}</td>
                  <td>{String(row.query ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
