import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { login, register } from '../api/client';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (password.length < 12) {
          setError('La contraseña debe tener al menos 12 caracteres');
          setLoading(false);
          return;
        }
        await register({ email, password, nombre, telefono: telefono || undefined });
      }
      await refresh();
      navigate('/consulta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="login-box">
      <h2>PharmaCol</h2>
      <p className="login-subtitle">Consultas farmacéuticas INVIMA</p>

      <div className="login-tabs">
        <button
          type="button"
          className={mode === 'login' ? 'login-tab login-tab-active' : 'login-tab'}
          onClick={() => switchMode('login')}
        >
          Ingresar
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'login-tab login-tab-active' : 'login-tab'}
          onClick={() => switchMode('register')}
        >
          Registrarse
        </button>
      </div>

      <form onSubmit={onSubmit}>
        {mode === 'register' ? (
          <>
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Teléfono (opcional)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </>
        ) : null}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder={mode === 'register' ? 'Contraseña (mín. 12 caracteres)' : 'Contraseña'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 12 : 1}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />
        {mode === 'register' ? (
          <p className="login-hint">Su cuenta se creará con rol <strong>Regente</strong>.</p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Espere…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
