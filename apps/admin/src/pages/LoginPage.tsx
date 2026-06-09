import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@pharmacol.co');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/consulta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas');
    }
  }

  return (
    <div className="login-box">
      <h2>PharmaCol</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Consultas farmacéuticas INVIMA</p>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn" style={{ width: '100%' }}>
          Ingresar
        </button>
      </form>
    </div>
  );
}
