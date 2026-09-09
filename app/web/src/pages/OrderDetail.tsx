import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { useNotifications } from '../context/NotificationContext';
import { Order } from '../types';
import { ORDER_STATUS, SUPPLIER_FLOW, formatMoney, formatDate } from '../lib/constants';
import Modal from '../components/Modal';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useNotifications();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<{ action: string; new_values: string; created_at: string }[]>([]);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: number; name: string; plate: string; type: string }[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({ vehicle_id: '', driver_id: '', scheduled_time: '' });

  const isSupplier = user?.role === 'proveedor_admin';
  const canManageDelivery = isSupplier || user?.role === 'admin' || user?.role === 'gerente';

  const load = () => {
    api<Order>(`/orders/${id}`).then(setOrder).catch(console.error);
    api<{ action: string; new_values: string; created_at: string }[]>(`/orders/${id}/history`).then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    load();
    if (canManageDelivery) {
      api<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
      api<{ id: number; name: string; plate: string; type: string }[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
    }
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = (o: Order) => {
      if (String(o.id) === String(id)) load();
    };
    socket.on('order:updated', onUpdate);
    return () => {
      socket.off('order:updated', onUpdate);
    };
  }, [id, canManageDelivery]);

  const changeStatus = async (status: string) => {
    try {
      await api<Order>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      push({ message: `Pedido actualizado → ${status}`, at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const createDelivery = async () => {
    try {
      await api('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order!.id,
          vehicle_id: deliveryForm.vehicle_id ? Number(deliveryForm.vehicle_id) : null,
          driver_id: deliveryForm.driver_id ? Number(deliveryForm.driver_id) : null,
          scheduled_time: deliveryForm.scheduled_time || null,
          items: order!.items.map((i) => ({ product_name: i.name, quantity: i.quantity, unit: i.unit })),
        }),
      });
      push({ message: 'Entrega creada y asignada al domiciliario exitosamente', at: new Date().toISOString() });
      setDeliveryModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!order) return <div className="py-10 text-center text-gray-500">Cargando pedido...</div>;

  const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-700' };
  const done = ['entregado', 'cancelado'].includes(order.status);
  const latestDelivery = order.deliveries && order.deliveries.length > 0 ? order.deliveries[0] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link to="/pedidos" className="mb-3 inline-block text-sm text-brand hover:underline font-medium">← Volver a pedidos</Link>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{order.order_code}</h2>
              <p className="text-sm text-gray-500">
                {isSupplier ? order.restaurant_name : order.supplier_name} · {formatDate(order.created_at)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.color}`}>{st.label}</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cantidad</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="py-2">{i.name}</td>
                  <td className="py-2 text-right">{i.quantity} {i.unit}</td>
                  <td className="py-2 text-right">{formatMoney(i.unit_price)}</td>
                  <td className="py-2 text-right">{formatMoney(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end text-lg font-bold">Total: {formatMoney(order.total)}</div>
          {order.notes && <p className="mt-3 rounded-lg bg-gray-50 p-2.5 text-sm text-gray-600">Notas: {order.notes}</p>}
          {order.delivery_address && <p className="mt-2 text-sm text-gray-600">📍 Dirección de entrega: {order.delivery_address}</p>}
          {order.requested_delivery_date && (
            <p className="mt-1 text-sm text-gray-600">📅 Entrega solicitada: {formatDate(order.requested_delivery_date)}</p>
          )}
        </div>

        {/* Tarjeta destacada de seguimiento de entrega y domiciliario */}
        {latestDelivery && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛵</span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Seguimiento de Entrega GPS</h3>
                  <p className="text-xs text-slate-500 font-mono">Código: {latestDelivery.delivery_code}</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white capitalize shadow-sm">
                {latestDelivery.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <p>
                <b className="text-slate-900">Domiciliario:</b>{' '}
                {latestDelivery.driver_name ? (
                  <span className="font-semibold text-blue-700">{latestDelivery.driver_name}</span>
                ) : (
                  <span className="text-amber-600 font-medium">⚠️ Sin domiciliario asignado</span>
                )}
              </p>
              {latestDelivery.driver_phone && (
                <p><b className="text-slate-900">Teléfono:</b> {latestDelivery.driver_phone}</p>
              )}
              {latestDelivery.vehicle_name && (
                <p><b className="text-slate-900">Vehículo:</b> {latestDelivery.vehicle_name} ({latestDelivery.plate})</p>
              )}
              {latestDelivery.confirmation_code && (
                <p>
                  <b className="text-slate-900">Código de Confirmación:</b>{' '}
                  <span className="font-mono font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded shadow-sm">
                    {latestDelivery.confirmation_code}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-blue-100">
              <Link
                to="/entregas"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
              >
                🗺️ Ver en Mapa GPS en Tiempo Real
              </Link>
              {canManageDelivery && (
                <button
                  onClick={() => {
                    setDeliveryForm({
                      driver_id: latestDelivery.driver_id ? String(latestDelivery.driver_id) : '',
                      vehicle_id: latestDelivery.vehicle_id ? String(latestDelivery.vehicle_id) : '',
                      scheduled_time: latestDelivery.scheduled_time || '',
                    });
                    setDeliveryModal(true);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                >
                  ✏️ Cambiar Domiciliario / Vehículo
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-2 font-bold text-slate-800 text-sm">Historial de Eventos</h3>
          {history.length === 0 && <p className="text-sm text-gray-400">Sin eventos registrados.</p>}
          <ul className="space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between border-b py-1.5">
                <span>{h.action === 'create' ? 'Pedido creado' : `Cambio de estado: ${h.action}`}</span>
                <span className="text-gray-400 text-xs">{formatDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="h-fit rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">Gestión del Pedido</h3>

        {/* Botón directo para asignar domiciliario si aún no tiene */}
        {canManageDelivery && (!latestDelivery || !latestDelivery.driver_id) && !done && (
          <button
            onClick={() => setDeliveryModal(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 transition"
          >
            🛵 Asignar Domiciliario al Pedido
          </button>
        )}

        {isSupplier ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flujo de Estados:</p>
            {SUPPLIER_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={done || order.status === s || SUPPLIER_FLOW.indexOf(s) < SUPPLIER_FLOW.indexOf(order.status)}
                className="w-full rounded-xl border border-brand py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white disabled:opacity-40 transition"
              >
                Marcar como {ORDER_STATUS[s].label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => changeStatus('cancelado')}
            disabled={done}
            className="w-full rounded-xl border border-red-500 py-2 text-sm font-medium text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-40 transition"
          >
            Cancelar pedido
          </button>
        )}
        <p className="text-xs text-gray-400">Los cambios se sincronizan en tiempo real.</p>
      </div>

      {deliveryModal && (
        <Modal title="Asignar Domiciliario y Programar Entrega" onClose={() => setDeliveryModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar Domiciliario / Conductor:</label>
              <select
                value={deliveryForm.driver_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, driver_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
                required
              >
                <option value="">-- Elige un usuario del sistema --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'} {d.phone ? `· 📞 ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No se encontraron usuarios registrados.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo de Entrega (opcional):</label>
              <select
                value={deliveryForm.vehicle_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicle_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Sin vehículo específico asignado --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate}) · {v.type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Fecha y hora estimada (opcional):</label>
              <input
                type="datetime-local"
                value={deliveryForm.scheduled_time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, scheduled_time: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createDelivery}
              disabled={!deliveryForm.driver_id}
              className="w-full rounded-xl bg-brand py-2.5 text-white font-bold hover:bg-brand-dark disabled:opacity-50 shadow transition"
            >
              Asignar Domiciliario y Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}