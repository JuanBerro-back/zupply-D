import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface TeamUser {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_name: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

const RESTAURANT_ROLES = [
  { id: 2, name: 'gerente', label: 'Gerente' },
  { id: 3, name: 'empleado', label: 'Empleado' },
  { id: 5, name: 'domiciliario', label: 'Domiciliario' },
];

const SUPPLIER_ROLES = [
  { id: 5, name: 'domiciliario', label: 'Domiciliario' },
];

export default function TeamManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', phone: '', role_id: 3 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isSupplier = user?.role === 'proveedor_admin';
  const availableRoles = isSupplier ? SUPPLIER_ROLES : RESTAURANT_ROLES;

  const loadUsers = async () => {
    try {
      const data = await api<TeamUser[]>('/users');
      setUsers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingUser) {
        await api(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, role_id: form.role_id }),
        });
      } else {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      setEditingUser(null);
      setForm({ username: '', password: '', name: '', email: '', phone: '', role_id: 3 });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (u: TeamUser) => {
    setEditingUser(u);
    setForm({ username: u.username, password: '', name: u.name, email: u.email || '', phone: u.phone || '', role_id: u.role_id });
    setShowForm(true);
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPass = prompt('Nueva contraseña (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) return;
    try {
      await api(`/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPass }),
      });
      alert('Contraseña actualizada');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando equipo...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión de Equipo</h1>
        <button
          onClick={() => { setShowForm(true); setEditingUser(null); setForm({ username: '', password: '', name: '', email: '', phone: '', role_id: isSupplier ? 5 : 3 }); }}
          className="rounded bg-brand px-4 py-2 text-white hover:bg-brand-dark"
        >
          + Nuevo Usuario
        </button>
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Usuario</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full rounded border px-3 py-2" required />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre completo</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-3 py-2" required />
              </div>
              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Contraseña</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded border px-3 py-2" required minLength={6} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rol</label>
                <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                  className="w-full rounded border px-3 py-2">
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 rounded bg-brand py-2 text-white hover:bg-brand-dark">
                  {editingUser ? 'Guardar' : 'Crear'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }}
                  className="flex-1 rounded bg-gray-200 py-2 hover:bg-gray-300">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                    {u.role_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(u)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">
                      Editar
                    </button>
                    <button onClick={() => handleResetPassword(u.id)} className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-200">
                      Pass
                    </button>
                    <button onClick={() => handleDeactivate(u.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No hay usuarios registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
