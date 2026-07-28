import { useMemo, useState } from 'react';
import { lookupCumBatch, getErrorMessage } from '../api/client';
import type { CumBatchLookupItem, CumBatchLookupResponse } from '../types/medicamentos';

function normalizeInput(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function estadoClass(item: CumBatchLookupItem): string {
  if (item.estadoConsulta === 'NO_EXISTE') return 'cum-estado-none';
  if (item.estadoConsulta === 'ACTIVO') return 'cum-estado-ok';
  return 'cum-estado-warn';
}

export default function CumEstadoPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CumBatchLookupResponse | null>(null);

  const countInput = useMemo(() => normalizeInput(text).length, [text]);

  async function onConsultar() {
    setLoading(true);
    setError(null);
    try {
      const data = await lookupCumBatch({ texto: text });
      setResult(data);
    } catch (e) {
      setError(getErrorMessage(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onLimpiar() {
    setText('');
    setError(null);
    setResult(null);
  }

  return (
    <div>
      <h2>Verificar Estado CUM</h2>
      <p style={{ color: '#555', marginTop: 4 }}>
        Pegue uno o varios codigos CUM (separados por coma o salto de linea) para validar si estan activos,
        inactivos o no existen en la base INVIMA sincronizada.
      </p>

      <div className="card">
        <label htmlFor="cum-input" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Codigos CUM
        </label>
        <textarea
          id="cum-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={'Ejemplo:\n3521-1\n20031822-1\n999999-1'}
          style={{
            width: '100%',
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
          }}
        />
        <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          Codigos detectados: <strong>{countInput}</strong>
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" disabled={loading || countInput === 0} onClick={onConsultar}>
            {loading ? 'Consultando…' : 'Consultar CUM'}
          </button>
          <button className="btn" style={{ background: '#607d8b' }} onClick={onLimpiar} disabled={loading}>
            Limpiar
          </button>
        </div>
      </div>

      {error ? (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="card">
          <h3>Resultado</h3>
          {result.resumen ? (
            <div className="stats" style={{ marginBottom: 12 }}>
              <div className="stat">
                <strong>{result.resumen.totalConsultados}</strong>
                <span>Consultados</span>
              </div>
              <div className="stat">
                <strong>{result.resumen.activos}</strong>
                <span>Activos</span>
              </div>
              <div className="stat">
                <strong>{result.resumen.inactivos}</strong>
                <span>Inactivos</span>
              </div>
              <div className="stat">
                <strong>{result.resumen.noExiste}</strong>
                <span>No existe</span>
              </div>
            </div>
          ) : null}

          <table>
            <thead>
              <tr>
                <th>CUM</th>
                <th>Estado</th>
                <th>Medicamento</th>
                <th>Registro INVIMA</th>
                <th>Laboratorio</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {(result.items ?? []).map((item) => (
                <tr key={item.codigoCum}>
                  <td className="med-mono">{item.codigoCum}</td>
                  <td>
                    <span className={`cum-estado ${estadoClass(item)}`}>
                      {item.estadoConsulta === 'NO_EXISTE'
                        ? 'NO EXISTE'
                        : `${item.estadoConsulta}${item.estadoCum ? ` (${item.estadoCum})` : ''}`}
                    </span>
                  </td>
                  <td>{item.medicamento?.nombreComercial ?? '—'}</td>
                  <td className="med-mono">{item.medicamento?.numeroRegistro ?? '—'}</td>
                  <td>{item.medicamento?.laboratorio ?? '—'}</td>
                  <td>{item.descripcionProducto ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
