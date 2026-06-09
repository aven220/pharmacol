import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchMedicamento, fetchPresentaciones, getErrorMessage } from '../api/client';
import { mapMedicamentoDetail, type MedicamentoDetail, type PresentacionItem } from '../types/medicamentos';

function InfoRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value?.trim()) return null;
  return (
    <div className={`info-row${highlight ? ' info-row-highlight' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function resolvePresentacion(
  items: PresentacionItem[],
  cumId?: string | null,
  cum?: string | null,
): PresentacionItem | undefined {
  if (cumId) {
    const byId = items.find((p) => p.id === cumId);
    if (byId) return byId;
  }
  if (cum) {
    const byCum = items.find((p) => p.cum?.toLowerCase() === cum.toLowerCase());
    if (byCum) return byCum;
  }
  return undefined;
}

export default function MedicamentoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const cumId = searchParams.get('cumId');
  const cum = searchParams.get('cum');

  const [detail, setDetail] = useState<MedicamentoDetail | null>(null);
  const [presentaciones, setPresentaciones] = useState<PresentacionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchMedicamento(id), fetchPresentaciones(id)])
      .then(([raw, presData]) => {
        setDetail(mapMedicamentoDetail(raw));
        setPresentaciones(presData.presentaciones);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Cargando ficha…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!detail) return null;

  const presFromApi = resolvePresentacion(presentaciones, cumId, cum);

  return (
    <div className="ficha">
      <Link to={`/consulta/${id}`} className="back-link">
        ← Presentaciones
      </Link>

      <h2>{detail.nombreComercial}</h2>
      {presFromApi?.etiquetaPresentacion ? (
        <p className="ficha-subtitle">{presFromApi.etiquetaPresentacion}</p>
      ) : null}

      <section className="ficha-section">
        <h3>Identificación</h3>
        <dl className="info-list">
          <InfoRow label="Registro INVIMA" value={presFromApi?.numeroRegistro ?? detail.numeroRegistro} />
          <InfoRow label="CUM" value={presFromApi?.cum} highlight />
          <InfoRow label="Estado registro" value={presFromApi?.estadoRegistro ?? detail.estadoRegistro} />
          <InfoRow label="Estado CUM" value={presFromApi?.estadoCum} />
        </dl>
      </section>

      <section className="ficha-section">
        <h3>Presentación</h3>
        <dl className="info-list">
          <InfoRow
            label="Presentación comercial"
            value={presFromApi?.embalaje ?? presFromApi?.presentacionComercial ?? presFromApi?.etiquetaPresentacion}
            highlight
          />
          <InfoRow label="Descripción INVIMA" value={presFromApi?.descripcionProducto} />
          <InfoRow label="Concentración" value={presFromApi?.concentracion ?? detail.concentracion} />
          <InfoRow label="Forma farmacéutica" value={presFromApi?.formaFarmaceutica ?? detail.formaFarmaceutica} />
          <InfoRow
            label="Cantidad"
            value={
              presFromApi?.cantidad
                ? `${presFromApi.cantidad}${presFromApi.unidad ? ` ${presFromApi.unidad}` : ''}`
                : undefined
            }
          />
          <InfoRow label="Código barras" value={presFromApi?.codigoBarras} />
          <InfoRow label="Vía administración" value={detail.viaAdministracion} />
        </dl>
      </section>

      <section className="ficha-section">
        <h3>Titular / Laboratorio</h3>
        <dl className="info-list">
          <InfoRow label="Laboratorio" value={detail.laboratorio} />
          <InfoRow label="Titular" value={detail.titular} />
        </dl>
      </section>

      {detail.principiosActivos.length > 0 ? (
        <section className="ficha-section">
          <h3>Principios activos</h3>
          <ul className="bullet-list">
            {detail.principiosActivos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.indicaciones ? (
        <section className="ficha-section">
          <h3>Indicaciones</h3>
          <p className="body-text">{detail.indicaciones}</p>
        </section>
      ) : null}

      {detail.contraindicaciones ? (
        <section className="ficha-section">
          <h3>Contraindicaciones</h3>
          <p className="body-text">{detail.contraindicaciones}</p>
        </section>
      ) : null}
    </div>
  );
}
