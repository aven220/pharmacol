import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchDispositivo, getErrorMessage } from '../api/client';

export default function DispositivoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDispositivo(id)
      .then(setData)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Cargando dispositivo…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const registro = data.registroInvima as Record<string, unknown> | undefined;
  const fabricante = data.fabricante as Record<string, unknown> | undefined;
  const importador = data.importador as Record<string, unknown> | undefined;

  return (
    <div>
      <Link to="/consulta" className="back-link">
        ← Volver a búsqueda
      </Link>
      <h2>{String(data.nombre ?? 'Dispositivo')}</h2>
      {registro?.numeroRegistro ? (
        <p className="med-meta">{String(registro.numeroRegistro)}</p>
      ) : null}
      {data.estadoRegistro ? (
        <p className="med-meta">Estado: {String(data.estadoRegistro)}</p>
      ) : null}
      {data.categoria ? <p className="med-meta">Categoría: {String(data.categoria)}</p> : null}
      {data.claseRiesgo ? (
        <p className="med-meta">Clase de riesgo: {String(data.claseRiesgo)}</p>
      ) : null}
      {fabricante?.razonSocial ? (
        <p className="med-meta">Fabricante / titular: {String(fabricante.razonSocial)}</p>
      ) : null}
      {importador?.razonSocial ? (
        <p className="med-meta">Importador: {String(importador.razonSocial)}</p>
      ) : null}
      {data.descripcion ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Descripción</h3>
          <p>{String(data.descripcion)}</p>
        </div>
      ) : null}
    </div>
  );
}
