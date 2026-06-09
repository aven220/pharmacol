import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPresentaciones, getErrorMessage } from '../api/client';
import type { PresentacionItem, PresentacionesResponse } from '../types/medicamentos';

export default function MedicamentoPresentacionesPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PresentacionesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPresentaciones(id)
      .then(setData)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Cargando presentaciones…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const { medicamento, presentaciones, total } = data;

  return (
    <div>
      <Link to="/consulta" className="back-link">
        ← Volver a búsqueda
      </Link>

      <h2>{medicamento.nombreComercial}</h2>
      {medicamento.concentracion ? (
        <p className="med-meta">
          {medicamento.concentracion}
          {medicamento.formaFarmaceutica ? ` · ${medicamento.formaFarmaceutica}` : ''}
        </p>
      ) : null}
      {medicamento.laboratorio ? <p className="med-meta">{medicamento.laboratorio}</p> : null}
      {medicamento.numeroRegistro ? <p className="med-meta">{medicamento.numeroRegistro}</p> : null}

      <p className="pres-count">
        {total} presentación{total === 1 ? '' : 'es'} encontrada{total === 1 ? '' : 's'}
      </p>

      <div className="pres-list">
        {presentaciones.map((pres) => (
          <PresentacionCard key={pres.id} medicamentoId={id!} pres={pres} />
        ))}
      </div>
    </div>
  );
}

function PresentacionCard({ medicamentoId, pres }: { medicamentoId: string; pres: PresentacionItem }) {
  const label = pres.etiquetaPresentacion ?? pres.presentacionComercial ?? pres.embalaje ?? 'Presentación';
  const fichaUrl = `/consulta/${medicamentoId}/ficha?cumId=${encodeURIComponent(pres.id)}${pres.cum ? `&cum=${encodeURIComponent(pres.cum)}` : ''}`;

  return (
    <Link to={fichaUrl} className="pres-card">
      <strong className="pres-etiqueta">{label}</strong>
      {pres.descripcionProducto &&
      label !== pres.descripcionProducto &&
      !label.includes(pres.descripcionProducto.slice(0, 40)) ? (
        <p className="pres-desc">{pres.descripcionProducto}</p>
      ) : pres.descripcionProducto ? (
        <p className="pres-desc">{pres.descripcionProducto}</p>
      ) : null}
      {pres.laboratorio ? <p className="pres-lab">{pres.laboratorio}</p> : null}
      <span className="pres-link">Ver ficha completa →</span>
    </Link>
  );
}
