import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RegisterData } from '../context/AuthContext';

const empty: RegisterData = {
  username: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  type: 'restaurante',
};

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterData>(empty);
  const [error, setError] = useState('');

  const set = (k: keyof RegisterData) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const input = 'w-full rounded border px-3 py-2';
  const label = 'mb-1 block text-sm font-medium';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-bold text-brand">Crear cuenta Zupply</h1>
        <p className="mb-6 text-sm text-gray-600">Regístrate como restaurante o proveedor</p>
        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={label}>Nombre del negocio</label>
            <input value={form.name} onChange={set('name')} className={input} required />
          </div>
          <div>
            <label className={label}>Tipo de cuenta</label>
            <select value={form.type} onChange={set('type')} className={input}>
              <option value="restaurante">Restaurante</option>
              <option value="proveedor">Proveedor</option>
            </select>
          </div>
          <div>
            <label className={label}>Usuario</label>
            <input value={form.username} onChange={set('username')} className={input} required />
          </div>
          <div>
            <label className={label}>Contraseña</label>
            <input type="password" value={form.password} onChange={set('password')} className={input} required />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={input} />
          </div>
          <div>
            <label className={label}>Teléfono</label>
            <input value={form.phone} onChange={set('phone')} className={input} />
          </div>
          <button className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark">Crear cuenta</button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿Ya tienes cuenta? <Link to="/login" className="text-brand hover:underline">Ingresa</Link>
        </p>
      </div>
    </div>
  );
}