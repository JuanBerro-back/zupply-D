import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import { ORDER_STATUS, formatMoney, formatDate } from '../lib/constants';

interface Summary {
  orders: { total: number; nuevos: number; activos: number; monto_total: number };
  products: number;
  recent: Order[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>('/dashboard/summary').then(setSummary).catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      api('/auth/notify-me').catch(() => undefined);
    }
  }, [user]);

  if (!summary) return <div className="py-10 text-center text-gray-500">Cargando...</div>;

  const cards = [
    { label: 'Pedidos totales', value: summary.orders.total },
    { label: 'Nuevos', value: summary.orders.nuevos, color: 'text-blue-600' },
    { label: 'En curso', value: summary.orders.activos, color: 'text-orange-600' },
    { label: 'Monto total', value: formatMoney(summary.orders.monto_total), color: 'text-brand' },
  ];

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">
        Dashboard{user?.role === 'proveedor_admin' ? ' del proveedor' : ''}
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color ?? ''}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-semibold">Últimos pedidos</h3>
        {summary.recent.length === 0 && <p className="text-sm text-gray-500">Sin pedidos recientes.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {summary.recent.map((o) => {
            const st = ORDER_STATUS[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <Link key={o.id} to={`/pedidos/${o.id}`} className="rounded border p-3 hover:bg-gray-50">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">{o.order_code}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                </div>
                <p className="text-xs text-gray-500">{o.restaurant_name} → {o.supplier_name}</p>
                <p className="text-xs text-gray-400">{formatDate(o.created_at)} · {formatMoney(o.total)}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}