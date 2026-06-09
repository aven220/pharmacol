import { useEffect, useState } from 'react';
import { fetchStats, getErrorMessage } from '../api/client';

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p>Cargando...</p>;

  const cards = [
    ['Usuarios', stats.usuarios],
    ['Medicamentos', stats.medicamentos],
    ['Dispositivos', stats.dispositivos],
    ['Sync jobs', stats.syncJobs],
    ['Sync fallidos', stats.syncFallidos],
    ['Consultas hoy', stats.consultasHoy],
    ['Alertas críticas/altas', stats.alertasAbiertas],
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="stats">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="stat">
            <strong>{String(value ?? 0)}</strong>
            <span>{String(label)}</span>
          </div>
        ))}
      </div>
      {stats.ultimaSync ? (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Última sincronización</h3>
          <pre style={{ fontSize: 12, overflow: 'auto' }}>
            {JSON.stringify(stats.ultimaSync, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
