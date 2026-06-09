import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getToken, logout } from './api/client';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import SyncPage from './pages/SyncPage';
import AuditPage from './pages/AuditPage';
import ConsultaPage from './pages/ConsultaPage';
import MedicamentoPresentacionesPage from './pages/MedicamentoPresentacionesPage';
import MedicamentoFichaPage from './pages/MedicamentoFichaPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>PharmaCol</h1>
        <nav>
          <NavLink to="/consulta">Consulta</NavLink>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/users">Usuarios</NavLink>
          <NavLink to="/sync">Sincronización</NavLink>
          <NavLink to="/audit">Auditoría</NavLink>
        </nav>
        <button type="button" className="btn" style={{ marginTop: 24, width: '100%' }} onClick={onLogout}>
          Cerrar sesión
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/consulta" element={<ConsultaPage />} />
                  <Route path="/consulta/:id" element={<MedicamentoPresentacionesPage />} />
                  <Route path="/consulta/:id/ficha" element={<MedicamentoFichaPage />} />
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/sync" element={<SyncPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
