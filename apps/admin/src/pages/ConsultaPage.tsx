import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getErrorMessage,
  searchMedicamentos,
  suggestMedicamentos,
} from '../api/client';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { mapMedicamentoSummary, type MedicamentoSummary } from '../types/medicamentos';

const MIN_CHARS = 2;

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

function MedicamentoCard({ item, highlight }: { item: MedicamentoSummary; highlight?: boolean }) {
  const score = item.score ? `${Math.round(item.score * 100)}%` : null;
  return (
    <Link
      to={`/consulta/${item.id}`}
      className={`med-card${highlight ? ' med-card-highlight' : ''}`}
    >
      <strong className="med-card-title">{item.nombreComercial}</strong>
      {item.concentracion ? <div className="med-card-meta">{item.concentracion}</div> : null}
      {item.formaFarmaceutica ? <div className="med-card-meta">{item.formaFarmaceutica}</div> : null}
      {item.numeroRegistro ? <div className="med-card-meta">{item.numeroRegistro}</div> : null}
      {item.laboratorio ? <div className="med-card-meta">{item.laboratorio}</div> : null}
      {item.numPresentaciones ? (
        <div className="med-card-pres">
          {item.numPresentaciones} presentación{item.numPresentaciones === 1 ? '' : 'es'}
        </div>
      ) : null}
      <div className="med-card-footer">
        <span className="med-badge">{item.estadoRegistro ?? '—'}</span>
        {score ? <span className="med-score">{score} coincidencia</span> : null}
      </div>
    </Link>
  );
}

export default function ConsultaPage() {
  const [input, setInput] = useState('');
  const [tipo, setTipo] = useState('nombre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MedicamentoSummary[]>([]);
  const [suggestions, setSuggestions] = useState<MedicamentoSummary[]>([]);
  const [relacionados, setRelacionados] = useState<MedicamentoSummary[]>([]);
  const [total, setTotal] = useState(0);

  const debouncedQuery = useDebouncedValue(input.trim(), 350);
  const isLiveSearch = input.trim().length >= MIN_CHARS;

  function selectTipo(next: string) {
    if (next === tipo) return;
    setTipo(next);
    setInput('');
    setResults([]);
    setSuggestions([]);
    setRelacionados([]);
    setError(null);
  }

  useEffect(() => {
    if (!isLiveSearch) {
      setResults([]);
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
        } else {
          const searchRes = await searchMedicamentos(debouncedQuery, tipo);
          if (cancelled) return;
          setResults(searchRes.items.map(mapMedicamentoSummary));
          setTotal(searchRes.meta.total);
          setSuggestions([]);
          setRelacionados([]);
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
  }, [debouncedQuery, tipo, isLiveSearch]);

  const showSuggestions = isLiveSearch && tipo === 'nombre' && suggestions.length > 0;
  const showResults = isLiveSearch && results.length > 0;
  const showEmpty = isLiveSearch && !loading && !error && !showResults;

  return (
    <div>
      <h2>Consulta farmacéutica</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Busque medicamentos por nombre, registro INVIMA, CUM o principio activo.
      </p>

      <div className="search-input-wrap">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={TIPO_PLACEHOLDERS[tipo] ?? 'Escriba para buscar...'}
          autoComplete="off"
        />
        {loading ? <span className="search-spinner">Buscando…</span> : null}
      </div>

      <div className="chips-row">
        {Object.entries(TIPO_LABELS).map(([t, label]) => (
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
          <h3>Sugerencias</h3>
          {suggestions.map((item) => (
            <MedicamentoCard key={`s-${item.id}`} item={item} highlight />
          ))}
        </div>
      ) : null}

      {showResults ? (
        <div className="search-section">
          <h3>Resultados ({total})</h3>
          {results.map((item) => (
            <MedicamentoCard key={item.id} item={item} />
          ))}
          {relacionados.length > 0 ? (
            <>
              <h3 style={{ marginTop: 24 }}>Medicamentos relacionados</h3>
              {relacionados.map((item) => (
                <MedicamentoCard key={`r-${item.id}`} item={item} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {showEmpty ? (
        <p className="empty-msg">Sin resultados para &quot;{debouncedQuery}&quot;</p>
      ) : null}

      {!isLiveSearch ? (
        <div className="empty-msg" style={{ marginTop: 32 }}>
          <p>Empiece a escribir para buscar en el catálogo INVIMA.</p>
        </div>
      ) : null}
    </div>
  );
}
