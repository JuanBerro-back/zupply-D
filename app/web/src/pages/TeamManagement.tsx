import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Modal from '../components/Modal';

interface TeamUser {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_name: string;
  role_label?: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

const RESTAURANT_ROLES = [
  { id: 5, name: 'domiciliario', label: '🛵 Domiciliario / Conductor' },
  { id: 2, name: 'gerente', label: '👑 Gerente de Restaurante' },
  { id: 3, name: 'empleado', label: '👤 Empleado Operativo' },
];

const SUPPLIER_ROLES = [
  { id: 5, name: 'domiciliario', label: '🛵 Domiciliario / Conductor de Entregas' },
  { id: 4, name: 'proveedor_admin', label: '🏢 Administrador Proveedor' },
];

export default function TeamManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', phone: '', role_id: 5 });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Filtros dinámicos
  const [activeTab, setActiveTab] = useState<'todos' | 'domiciliarios' | 'gerencia' | 'empleados'>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const isSupplier = user?.role === 'proveedor_admin';
  const availableRoles = isSupplier ? SUPPLIER_ROLES : RESTAURANT_ROLES;

  const loadUsers = async () => {
    try {
      const data = await api<TeamUser[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
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
    setSuccessMsg('');
    try {
      if (editingUser) {
        await api(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role_id: Number(form.role_id),
          }),
        });
        setSuccessMsg('Usuario actualizado correctamente');
      } else {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: form.username.trim(),
            password: form.password,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role_id: Number(form.role_id),
          }),
        });
        setSuccessMsg('Usuario creado exitosamente y disponible para asignación');
      }
      setShowForm(false);
      setEditingUser(null);
      setForm({ username: '', password: '', name: '', email: '', phone: '', role_id: 5 });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (u: TeamUser) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      email: u.email || '',
      phone: u.phone || '',
      role_id: u.role_id || 5,
    });
    setShowForm(true);
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('¿Deseas cambiar el estado de este usuario?')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPass = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) return;
    try {
      await api(`/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPass }),
      });
      alert('Contraseña actualizada correctamente');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Conteo por categorías
  const domiciliarios = useMemo(() => users.filter((u) => u.role_id === 5 || u.role_name === 'domiciliario'), [users]);
  const gerencia = useMemo(() => users.filter((u) => [1, 2, 4].includes(u.role_id) || ['admin', 'gerente', 'proveedor_admin'].includes(u.role_name)), [users]);
  const empleados = useMemo(() => users.filter((u) => u.role_id === 3 || u.role_name === 'empleado'), [users]);

  // Filtrado según pestaña y búsqueda
  const filteredUsers = useMemo(() => {
    let list = users;
    if (activeTab === 'domiciliarios') list = domiciliarios;
    else if (activeTab === 'gerencia') list = gerencia;
    else if (activeTab === 'empleados') list = empleados;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role_label && u.role_label.toLowerCase().includes(q))
    );
  }, [users, activeTab, searchQuery, domiciliarios, gerencia, empleados]);

  const getRoleBadge = (roleId: number, roleName: string) => {
    if (roleId === 5 || roleName === 'domiciliario') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 border border-sky-200 shadow-sm">
          <span>🛵</span> Domiciliario
        </span>
      );
    }
    if (roleId === 2 || roleName === 'gerente') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
          <span>👑</span> Gerente
        </span>
      );
    }
    if (roleId === 4 || roleName === 'proveedor_admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
          <span>🏢</span> Proveedor Admin
        </span>
      );
    }
    if (roleId === 1 || roleName === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
          <span>⭐</span> Administrador
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border">
        <span>👤</span> Empleado
      </span>
    );
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Cargando equipo de trabajo...</div>;

  return (
    <div className="space-y-5">
      {/* Cabecera Principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>👥</span> Gestión de Equipo y Domiciliarios
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Administra los usuarios de tu organización y asigna domiciliarios a las rutas de despacho.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setForm({ username: '', password: '', name: '', email: '', phone: '', role_id: 5 });
          }}
          className="rounded-xl bg-brand px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition flex items-center gap-1.5"
        >
          <span>+</span> Crear Usuario / Domiciliario
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="text-rose-500 font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 font-bold">✕</button>
        </div>
      )}

      {/* Pestañas de Filtrado y Buscador Dinámico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* Pestañas Segmentadas */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'todos'
                ? 'bg-white text-brand shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('domiciliarios')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              activeTab === 'domiciliarios'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🛵 Domiciliarios</span>
            <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] text-sky-800 font-black">
              {domiciliarios.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('gerencia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'gerencia'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gerencia ({gerencia.length})
          </button>
          <button
            onClick={() => setActiveTab('empleados')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'empleados'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Empleados ({empleados.length})
          </button>
        </div>

        {/* Campo de Búsqueda Rápida */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, tel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Modal de Crear / Editar Usuario */}
      {showForm && (
        <Modal
          title={editingUser ? `Editar Usuario: ${editingUser.name}` : 'Crear Nuevo Usuario o Domiciliario'}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!editingUser && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nombre de Usuario (Login) *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="ej. carlos_repartidor"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nombre Completo *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ej. Carlos Mendoza"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                required
              />
            </div>

            {!editingUser && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Contraseña *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                  minLength={6}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Teléfono Móvil (WhatsApp)</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="ej. 3151234567"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Correo Electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ej. carlos@correo.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Rol en la Organización *</label>
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
              >
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Los usuarios con rol <b>Domiciliario</b> se mostrarán automáticamente en el mapa GPS para asignar pedidos.
              </p>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark active:scale-95 transition shadow-sm"
              >
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vista Móvil: Tarjetas Responsivas (Especial para Android) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.map((u) => {
          const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

          return (
            <div
              key={u.id}
              className={`rounded-2xl border p-4 shadow-sm bg-white transition ${
                isDom ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-lg ${
                      isDom
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-brand/10 text-brand'
                    }`}
                  >
                    {u.name ? u.name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{u.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                  </div>
                </div>
                {getRoleBadge(u.role_id, u.role_name)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">TELÉFONO</span>
                  {u.phone ? (
                    <a href={`tel:${u.phone}`} className="text-brand font-medium">
                      📞 {u.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">Sin teléfono</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ESTADO</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      u.is_active ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {/* Botón destacado para Domiciliarios */}
              {isDom && (
                <div className="mt-3">
                  <button
                    onClick={() => navigate('/logistica')}
                    className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold text-xs py-2 shadow-sm hover:from-sky-700 hover:to-sky-800 transition flex items-center justify-center gap-1.5"
                  >
                    <span>🗺️</span> Asignar Pedido / Ver en Mapa GPS
                  </button>
                </div>
              )}

              {/* Acciones de Edición */}
              <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(u)}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleResetPassword(u.id)}
                  className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Clave
                </button>
                <button
                  onClick={() => handleDeactivate(u.id)}
                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {u.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-bold text-slate-800">No se encontraron usuarios</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otra pestaña o limpia el buscador.</p>
          </div>
        )}
      </div>

      {/* Vista Desktop: Tabla Dinámica */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-500 border-b">
            <tr>
              <th className="px-5 py-3.5">Usuario</th>
              <th className="px-5 py-3.5">Nombre</th>
              <th className="px-5 py-3.5">Rol</th>
              <th className="px-5 py-3.5">Contacto</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => {
              const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

              return (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-900 font-mono text-xs">
                    {u.username}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email || 'Sin correo'}</div>
                  </td>
                  <td className="px-5 py-3.5">{getRoleBadge(u.role_id, u.role_name)}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    {u.phone ? (
                      <a href={`tel:${u.phone}`} className="text-brand font-medium hover:underline">
                        📞 {u.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isDom && (
                        <button
                          onClick={() => navigate('/logistica')}
                          className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-700 shadow-sm"
                          title="Ver en mapa GPS y asignar pedidos"
                        >
                          🗺️ Asignar Pedido
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(u)}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                      >
                        Clave
                      </button>
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200"
                      >
                        {u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-500 font-medium">
                  No hay usuarios registrados en esta categoría
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
