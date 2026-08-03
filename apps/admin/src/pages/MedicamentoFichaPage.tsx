import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchMedicamento, fetchMedicamentoAlertas, fetchPresentaciones, getErrorMessage } from '../api/client';
import { mapMedicamentoDetail, type MedicamentoAlertaItem, type MedicamentoDetail, type PresentacionItem } from '../types/medicamentos';

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

function alertaBadgeClass(tipo?: string): string {
  switch (tipo) {
    case 'AGOTADO':
      return 'alerta-badge alerta-badge-agotado';
    case 'RETIRO':
      return 'alerta-badge alerta-badge-retiro';
    case 'CARTA':
      return 'alerta-badge alerta-badge-carta';
    case 'INFORME_SEGURIDAD':
      return 'alerta-badge alerta-badge-informe';
    default:
      return 'alerta-badge alerta-badge-otro';
  }
}

export default function MedicamentoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const cumId = searchParams.get('cumId');
  const cum = searchParams.get('cum');

  const [detail, setDetail] = useState<MedicamentoDetail | null>(null);
  const [presentaciones, setPresentaciones] = useState<PresentacionItem[]>([]);
  const [alertas, setAlertas] = useState<MedicamentoAlertaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchMedicamento(id), fetchPresentaciones(id), fetchMedicamentoAlertas(id)])
      .then(([raw, presData, alertasData]) => {
        setDetail(mapMedicamentoDetail(raw));
        setPresentaciones(presData.presentaciones);
        setAlertas(alertasData.items ?? []);
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
            value={
              presFromApi?.embalajeResumen ??
              presFromApi?.embalaje ??
              presFromApi?.presentacionComercial ??
              presFromApi?.etiquetaPresentacion
            }
            highlight
          />
          <InfoRow label="Contenido del envase" value={presFromApi?.contenidoEnvase} highlight />
          <InfoRow label="Unidades por blister" value={presFromApi?.unidadesPorBlister} highlight />
          <InfoRow
            label="Número de blisters"
            value={
              presFromApi?.blisterCantidad != null && presFromApi.blisterCantidad > 0
                ? String(presFromApi.blisterCantidad)
                : undefined
            }
          />
          <InfoRow label="Descripción INVIMA (texto original)" value={presFromApi?.descripcionProducto} />
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
          <table className="pa-table">
            <thead>
              <tr>
                <th>Principio activo</th>
                <th>Cantidad / concentración</th>
              </tr>
            </thead>
            <tbody>
              {detail.principiosActivos.map((p, i) => {
                const [nombre, cantidad] = p.includes(' — ')
                  ? (p.split(' — ') as [string, string])
                  : [p, ''];
                return (
                  <tr key={i}>
                    <td>{nombre}</td>
                    <td>{cantidad || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      <section className="ficha-section">
        <h3>Alertas y comunicados INVIMA</h3>
        <p className="med-meta" style={{ marginTop: 0 }}>
          Cartas de agotados, alertas sanitarias, informes de seguridad y otros comunicados oficiales
          relacionados con este medicamento.
        </p>
        {alertas.length === 0 ? (
          <p className="body-text">
            No se encontraron alertas vinculadas. Si el producto tiene novedades recientes, sincronice{' '}
            <Link to="/alertas">Alertas INVIMA</Link>.
          </p>
        ) : (
          <div className="alerta-list">
            {alertas.map((alerta) => (
              <article key={alerta.id} className="alerta-card">
                <div className="alerta-card-head">
                  <span className={alertaBadgeClass(alerta.tipoClasificado)}>
                    {alerta.tipoClasificadoLabel ?? 'Comunicado INVIMA'}
                  </span>
                  <span className="alerta-fecha">{String(alerta.fechaAlerta).slice(0, 10)}</span>
                </div>
                <strong className="alerta-titulo">{alerta.titulo}</strong>
                <p className="alerta-numero">Alerta No. {alerta.numeroAlerta}</p>
                <p className="alerta-desc">{alerta.descripcion.slice(0, 400)}{alerta.descripcion.length > 400 ? '…' : ''}</p>
                {alerta.documentoUrl ? (
                  <a
                    href={alerta.documentoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="alerta-pdf"
                  >
                    Ver documento PDF INVIMA →
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
