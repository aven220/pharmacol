import { useEffect, useState } from 'react';
import { fetchAudit } from '../api/client';

export default function AuditPage() {
  const [data, setData] = useState<{ items: Array<Record<string, unknown>> } | null>(null);

  useEffect(() => {
    fetchAudit().then(setData).catch(console.error);
  }, []);

  return (
    <div>
      <h2>Auditoría</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Recurso</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((log) => (
              <tr key={String(log.id)}>
                <td>{String(log.createdAt)}</td>
                <td>{String((log.user as { email?: string })?.email ?? '—')}</td>
                <td>{String(log.accion)}</td>
                <td>{String(log.recurso ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
