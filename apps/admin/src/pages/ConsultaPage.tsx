import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getErrorMessage,
  searchDispositivos,
  searchMedicamentos,
  suggestMedicamentos,
} from '../api/client';
import { MedicamentoCard } from '../components/MedicamentoCard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../auth/AuthContext';
import { mapMedicamentoSummary, type MedicamentoSummary } from '../types/medicamentos';

const MIN_CHARS = 2;

type Catalogo = 'medicamentos' | 'dispositivos';

const TIPO_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  registro: 'INVIMA',
  cum: 'CUM',
  principio_activo: 'Principio activo',
};

const TIPO_PLACEHOLDERS: Record<string, string> = {
  nombre: 'Ej: Acetaminofén, Amoxicilina...',
  registro: 'Ej: INVIMA 2023M-0012728-R2',
  cum: 'Ej: 20031822-1',
  principio_activo: 'Ej: Paracetamol, Ibuprofeno...',
};

type DispositivoSummary = {
  id: string;
  nombre: string;
  categoria?: string;
  estadoRegistro?: string;
  numeroRegistro?: string;
  fabricante?: string;
};

function mapDispositivo(raw: Record<string, unknown>): DispositivoSummary {
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const fab = raw.fabricante as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    nombre: String(raw.nombre ?? ''),
    categoria: (raw.categoria as string | undefined) ?? undefined,
    estadoRegistro: (raw.estadoRegistro as string | undefined) ?? undefined,
    numeroRegistro: (registro?.numeroRegistro as string | undefined) ?? undefined,
    fabricante: (fab?.razonSocial as string | undefined) ?? undefined,
  };
}

export default function ConsultaPage() {
  const { can } = useAuth();
  const canDm = can('dispositivos:read');
  const [catalogo, setCatalogo] = useState<Catalogo>('medicamentos');
  const [input, setInput] = useState('');
  const [tipo, setTipo] = useState('nombre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MedicamentoSummary[]>([]);
  const [dmResults, setDmResults] = useState<DispositivoSummary[]>([]);
  const [suggestions, setSuggestions] = useState<MedicamentoSummary[]>([]);
  const [relacionados, setRelacionados] = useState<MedicamentoSummary[]>([]);
  const [total, setTotal] = useState(0);

  const debouncedQuery = useDebouncedValue(input.trim(), 350);
  const isLiveSearch = input.trim().length >= MIN_CHARS;

  function selectCatalogo(next: Catalogo) {
    if (next === catalogo) return;
    setCatalogo(next);
    setInput('');
    setTipo('nombre');
    setResults([]);
    setDmResults([]);
    setSuggestions([]);
    setRelacionados([]);
    setError(null);
    setTotal(0);
  }

  function selectTipo(next: string) {
    if (next === tipo) return;
    setTipo(next);
    setInput('');
    setResults([]);
    setDmResults([]);
    setSuggestions([]);
    setRelacionados([]);
    setError(null);
  }

  useEffect(() => {
    if (!isLiveSearch) {
      setResults([]);
      setDmResults([]);
      setSuggestions([]);
      setRelacionados([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (catalogo === 'dispositivos') {
          const searchRes = await searchDispositivos(
            debouncedQuery,
            tipo === 'registro' ? 'registro' : 'nombre',
            1,
            20,
            true,
          );
          if (cancelled) return;
          setDmResults(searchRes.items.map(mapDispositivo));
          setTotal(searchRes.meta.total);
          setResults([]);
          setSuggestions([]);
          setRelacionados([]);
          return;
        }

        if (tipo === 'nombre') {
          const [searchRes, suggestRes] = await Promise.all([
            searchMedicamentos(debouncedQuery, tipo),
            suggestMedicamentos(debouncedQuery),
          ]);
          if (cancelled) return;
          setResults(searchRes.items.map(mapMedicamentoSummary));
          setTotal(searchRes.meta.total);
          setSuggestions(suggestRes.items.map(mapMedicamentoSummary));
          setRelacionados(suggestRes.relacionados.map(mapMedicamentoSummary));
          setDmResults([]);
        } else {
          const searchRes = await searchMedicamentos(debouncedQuery, tipo);
          if (cancelled) return;
          setResults(searchRes.items.map(mapMedicamentoSummary));
          setTotal(searchRes.meta.total);
          setSuggestions([]);
          setRelacionados([]);
          setDmResults([]);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, tipo, isLiveSearch, catalogo]);

  const showSuggestions =
    catalogo === 'medicamentos' && isLiveSearch && tipo === 'nombre' && suggestions.length > 0;
  const showResults =
    isLiveSearch &&
    ((catalogo === 'medicamentos' && results.length > 0) ||
      (catalogo === 'dispositivos' && dmResults.length > 0));
  const showEmpty = isLiveSearch && !loading && !error && !showResults;

  const tipoOptions =
    catalogo === 'dispositivos'
      ? { nombre: 'Nombre', registro: 'INVIMA' }
      : TIPO_LABELS;

  return (
    <div className="consulta-page">
      <h2>Consulta farmacéutica</h2>
      <p className="consulta-intro">
        Búsqueda en catálogo INVIMA. Elija medicamentos o dispositivos médicos; los resultados
        muestran registro sanitario y datos clave antes de abrir el detalle.
      </p>

      <div className="chips-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`chip${catalogo === 'medicamentos' ? ' chip-active' : ''}`}
          onClick={() => selectCatalogo('medicamentos')}
        >
          Medicamentos
        </button>
        {canDm ? (
          <button
            type="button"
            className={`chip${catalogo === 'dispositivos' ? ' chip-active' : ''}`}
            onClick={() => selectCatalogo('dispositivos')}
          >
            Dispositivos médicos
          </button>
        ) : null}
      </div>

      {catalogo === 'dispositivos' ? (
        <p className="hint" style={{ marginBottom: 12 }}>
          Si no aparecen resultados, un administrador debe sincronizar{' '}
          <code>INVIMA_DISPOSITIVOS</code> en Sincronización.
        </p>
      ) : null}

      <div className="search-input-wrap">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            catalogo === 'dispositivos'
              ? tipo === 'registro'
                ? 'Ej: INVIMA 2018DM-000456-R1'
                : 'Ej: Catéter, glucometro, stent...'
              : (TIPO_PLACEHOLDERS[tipo] ?? 'Escriba para buscar...')
          }
          autoComplete="off"
        />
        {loading ? <span className="search-spinner">Buscando…</span> : null}
      </div>

      <div className="chips-row">
        {Object.entries(tipoOptions).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={`chip${tipo === t ? ' chip-active' : ''}`}
            onClick={() => selectTipo(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {input.length > 0 && input.trim().length < MIN_CHARS ? (
        <p className="hint">Escriba al menos {MIN_CHARS} caracteres…</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {showSuggestions ? (
        <div className="search-section">
          <h3>Sugerencias ({suggestions.length})</h3>
          <div className="med-results-grid">
            {suggestions.map((item) => (
              <MedicamentoCard key={`s-${item.id}`} item={item} highlight />
            ))}
          </div>
        </div>
      ) : null}

      {showResults && catalogo === 'medicamentos' ? (
        <div className="search-section">
          <h3>
            Resultados ({total}
            {total > results.length ? ` — mostrando ${results.length}` : ''})
          </h3>
          <div className="med-results-grid">
            {results.map((item) => (
              <MedicamentoCard key={item.id} item={item} />
            ))}
          </div>
          {relacionados.length > 0 ? (
            <>
              <h3 style={{ marginTop: 24 }}>Medicamentos relacionados</h3>
              <div className="med-results-grid">
                {relacionados.map((item) => (
                  <MedicamentoCard key={`r-${item.id}`} item={item} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {showResults && catalogo === 'dispositivos' ? (
        <div className="search-section">
          <h3>
            Resultados ({total}
            {total > dmResults.length ? ` — mostrando ${dmResults.length}` : ''})
          </h3>
          <div className="med-results-grid">
            {dmResults.map((item) => (
              <Link key={item.id} to={`/dispositivos/${item.id}`} className="med-card">
                <strong>{item.nombre}</strong>
                {item.numeroRegistro ? <span>{item.numeroRegistro}</span> : null}
                {item.categoria ? <span>{item.categoria}</span> : null}
                {item.fabricante ? <span>{item.fabricante}</span> : null}
                {item.estadoRegistro ? <span className="med-estado">{item.estadoRegistro}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <p className="empty-msg">Sin resultados para &quot;{debouncedQuery}&quot;</p>
      ) : null}

      {!isLiveSearch ? (
        <div className="empty-msg consulta-empty">
          <p>Empiece a escribir para buscar en el catálogo INVIMA.</p>
          <ul>
            <li>
              <strong>Medicamentos</strong> — nombre, registro, CUM o principio activo
            </li>
            <li>
              <strong>Dispositivos</strong> — nombre o registro sanitario DM
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
