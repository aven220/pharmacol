import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, NAV_ITEMS, useAuth } from './auth/AuthContext';
import { getToken, logout } from './api/client';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import SyncPage from './pages/SyncPage';
import AuditPage from './pages/AuditPage';
import ConsultaPage from './pages/ConsultaPage';
import MedicamentoPresentacionesPage from './pages/MedicamentoPresentacionesPage';
import MedicamentoFichaPage from './pages/MedicamentoFichaPage';
import AlertasSanitariasPage from './pages/AlertasSanitariasPage';
import CumEstadoPage from './pages/CumEstadoPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (loading) return <p style={{ padding: 24 }}>Cargando sesión…</p>;
  return <>{children}</>;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Cargando…</p>;
  if (!can(permission)) return <Navigate to="/consulta" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { can } = useAuth();
  if (can('dashboard:view')) return <DashboardPage />;
  return <Navigate to="/consulta" replace />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { profile, can, clear } = useAuth();

  async function onLogout() {
    await logout();
    clear();
    navigate('/login');
  }

  const visibleNav = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>PharmaCol</h1>
        {profile ? (
          <p className="sidebar-user">
            {profile.nombre}
            <span>{profile.roles.join(', ')}</span>
          </p>
        ) : null}
        <nav>
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn" style={{ marginTop: 24, width: '100%' }} onClick={onLogout}>
          Cerrar sesión
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route
                  path="/consulta"
                  element={
                    <RequirePermission permission="medicamentos:read">
                      <ConsultaPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/consulta/:id"
                  element={
                    <RequirePermission permission="medicamentos:read">
                      <MedicamentoPresentacionesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/consulta/:id/ficha"
                  element={
                    <RequirePermission permission="medicamentos:read">
                      <MedicamentoFichaPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/cum-estado"
                  element={
                    <RequirePermission permission="medicamentos:read">
                      <CumEstadoPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/alertas"
                  element={
                    <RequirePermission permission="alertas:view">
                      <AlertasSanitariasPage />
                    </RequirePermission>
                  }
                />
                <Route path="/" element={<HomeRedirect />} />
                <Route
                  path="/users"
                  element={
                    <RequirePermission permission="users:manage">
                      <UsersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/sync"
                  element={
                    <RequirePermission permission="sync:view">
                      <SyncPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/actividad"
                  element={
                    <RequirePermission permission="audit:view">
                      <AuditPage />
                    </RequirePermission>
                  }
                />
                <Route path="/audit" element={<Navigate to="/actividad" replace />} />
                <Route path="*" element={<Navigate to="/consulta" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined;

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
