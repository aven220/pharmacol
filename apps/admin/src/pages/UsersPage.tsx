import { FormEvent, useEffect, useState } from 'react';
import {
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  getErrorMessage,
  updateUser,
} from '../api/client';

type Role = { codigo: string; nombre: string };
type UserRow = {
  id: string;
  email: string;
  nombre: string;
  status: string;
  telefono?: string | null;
  roles: Array<{ role: { codigo: string; nombre?: string } }>;
};

const STATUSES = ['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE_VERIFICACION'] as const;

const emptyForm = {
  email: '',
  password: '',
  nombre: '',
  telefono: '',
  status: 'ACTIVO',
  roleCodigos: ['CONSULTA'] as string[],
};

export default function UsersPage() {
  const [data, setData] = useState<{ items: UserRow[] } | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [users, roleList] = await Promise.all([fetchUsers(), fetchRoles()]);
    setData(users);
    setRoles(roleList.map((r: Role) => ({ codigo: r.codigo, nombre: r.nombre })));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setForm({
      email: user.email,
      password: '',
      nombre: user.nombre,
      telefono: user.telefono ?? '',
      status: user.status,
      roleCodigos: user.roles.map((r) => r.role.codigo),
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError(null);
  }

  function toggleRole(codigo: string) {
    setForm((prev) => {
      const has = prev.roleCodigos.includes(codigo);
      const roleCodigos = has
        ? prev.roleCodigos.filter((c) => c !== codigo)
        : [...prev.roleCodigos, codigo];
      return { ...prev, roleCodigos };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.roleCodigos.length) {
      setError('Seleccione al menos un rol');
      return;
    }
    if (!editing && form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const payload: Parameters<typeof updateUser>[1] = {
          email: form.email,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          status: form.status,
          roleCodigos: form.roleCodigos,
        };
        if (form.password) payload.password = form.password;
        await updateUser(editing.id, payload);
      } else {
        await createUser({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          status: form.status,
          roleCodigos: form.roleCodigos,
        });
      }
      closeModal();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!window.confirm(`¿Eliminar al usuario ${user.email}?`)) return;
    try {
      await deleteUser(user.id);
      await load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Usuarios</h2>
        <button className="btn" onClick={openCreate}>
          Nuevo usuario
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Roles</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.nombre}</td>
                <td>{u.status}</td>
                <td>{u.roles.map((r) => r.role.codigo).join(', ')}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => openEdit(u)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    style={{ marginLeft: 6 }}
                    onClick={() => handleDelete(u)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            <form onSubmit={handleSubmit}>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                <input
                  type="password"
                  required={!editing}
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label>
                Nombre
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>
              <label>
                Teléfono
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </label>
              <label>
                Estado
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="roles-fieldset">
                <legend>Roles</legend>
                {roles.map((r) => (
                  <label key={r.codigo} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.roleCodigos.includes(r.codigo)}
                      onChange={() => toggleRole(r.codigo)}
                    />
                    {r.nombre} ({r.codigo})
                  </label>
                ))}
              </fieldset>
              {error ? <p className="error">{error}</p> : null}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
