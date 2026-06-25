import { Link } from 'react-router-dom';
import type { MedicamentoSummary } from '../types/medicamentos';

function estadoClass(estado?: string): string {
  const e = (estado ?? '').toUpperCase();
  if (e === 'VIGENTE') return 'med-estado-vigente';
  if (e === 'VENCIDO' || e === 'CANCELADO') return 'med-estado-alerta';
  return 'med-estado-otro';
}

export function MedicamentoCard({
  item,
  highlight,
}: {
  item: MedicamentoSummary;
  highlight?: boolean;
}) {
  const score = item.score ? `${Math.round(item.score * 100)}%` : null;

  return (
    <Link
      to={`/consulta/${item.id}`}
      className={`med-card${highlight ? ' med-card-highlight' : ''}`}
    >
      <div className="med-card-head">
        <strong className="med-card-title">{item.nombreComercial}</strong>
        {item.estadoRegistro ? (
          <span className={`med-estado ${estadoClass(item.estadoRegistro)}`}>
            {item.estadoRegistro}
          </span>
        ) : null}
      </div>

      <dl className="med-info-grid">
        {item.principioActivo ? (
          <>
            <dt>Principio activo</dt>
            <dd>{item.principioActivo}</dd>
          </>
        ) : null}
        {item.concentracion ? (
          <>
            <dt>Concentración</dt>
            <dd>{item.concentracion}</dd>
          </>
        ) : null}
        {item.formaFarmaceutica ? (
          <>
            <dt>Forma farmacéutica</dt>
            <dd>{item.formaFarmaceutica}</dd>
          </>
        ) : null}
        {item.numeroRegistro ? (
          <>
            <dt>Registro INVIMA</dt>
            <dd className="med-mono">{item.numeroRegistro}</dd>
          </>
        ) : null}
        {item.cumPreview ? (
          <>
            <dt>CUM</dt>
            <dd className="med-mono">{item.cumPreview}</dd>
          </>
        ) : null}
        {item.laboratorio ? (
          <>
            <dt>Laboratorio</dt>
            <dd>{item.laboratorio}</dd>
          </>
        ) : null}
        {item.titular && item.titular !== item.laboratorio ? (
          <>
            <dt>Titular</dt>
            <dd>{item.titular}</dd>
          </>
        ) : null}
      </dl>

      <div className="med-card-footer">
        {item.numPresentaciones ? (
          <span className="med-card-pres">
            {item.numPresentaciones} presentación{item.numPresentaciones === 1 ? '' : 'es'} → ver detalle
          </span>
        ) : (
          <span className="med-card-pres">Ver presentaciones →</span>
        )}
        {score ? <span className="med-score">{score} coincidencia</span> : null}
      </div>
    </Link>
  );
}
