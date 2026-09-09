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
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: number; name: string; plate: string; type: string }[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({ vehicle_id: '', driver_id: '', scheduled_time: '' });

  const isSupplier = user?.role === 'proveedor_admin';

  const load = () => {
    api<Order>(`/orders/${id}`).then(setOrder).catch(console.error);
    api<{ action: string; new_values: string; created_at: string }[]>(`/orders/${id}/history`).then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    load();
    if (isSupplier) {
      api<{ id: number; name: string; username: string; phone?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
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
  }, [id, isSupplier]);

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
      push({ message: 'Entrega creada y asignada al domiciliario', at: new Date().toISOString() });
      setDeliveryModal(false);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!order) return <div className="py-10 text-center text-gray-500">Cargando pedido...</div>;

  const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-700' };
  const done = ['entregado', 'cancelado'].includes(order.status);
  const hasDelivery = order.status === 'despachado' && isSupplier;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link to="/pedidos" className="mb-3 inline-block text-sm text-brand hover:underline">← Volver a pedidos</Link>
        <div className="rounded-lg border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{order.order_code}</h2>
              <p className="text-sm text-gray-500">
                {isSupplier ? order.restaurant_name : order.supplier_name} · {formatDate(order.created_at)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${st.color}`}>{st.label}</span>
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
          {order.notes && <p className="mt-3 rounded bg-gray-50 p-2 text-sm text-gray-600">Notas: {order.notes}</p>}
          {order.delivery_address && <p className="mt-2 text-sm text-gray-600">Entrega: {order.delivery_address}</p>}
          {order.requested_delivery_date && (
            <p className="mt-1 text-sm text-gray-600">Entrega solicitada: {formatDate(order.requested_delivery_date)}</p>
          )}
        </div>

        <div className="mt-4 rounded-lg border bg-white p-5">
          <h3 className="mb-2 font-semibold">Historial</h3>
          {history.length === 0 && <p className="text-sm text-gray-400">Sin eventos registrados.</p>}
          <ul className="space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between border-b py-1">
                <span>{h.action === 'create' ? 'Pedido creado' : `Cambio de estado: ${h.action}`}</span>
                <span className="text-gray-400">{formatDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="h-fit rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-semibold">Acciones</h3>
        {isSupplier ? (
          <div className="space-y-2">
            {SUPPLIER_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={done || order.status === s || SUPPLIER_FLOW.indexOf(s) < SUPPLIER_FLOW.indexOf(order.status)}
                className="w-full rounded border border-brand py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-40"
              >
                Marcar como {ORDER_STATUS[s].label}
              </button>
            ))}
            {hasDelivery && (
              <button onClick={() => setDeliveryModal(true)} className="w-full rounded border border-indigo-500 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-500 hover:text-white">
                Crear entrega
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => changeStatus('cancelado')}
            disabled={done}
            className="w-full rounded border border-red-500 py-2 text-sm font-medium text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-40"
          >
            Cancelar pedido
          </button>
        )}
        <p className="mt-3 text-xs text-gray-400">Los cambios se sincronizan en tiempo real.</p>
      </div>

      {deliveryModal && (
        <Modal title="Crear entrega y asignar domiciliario" onClose={() => setDeliveryModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Domiciliario / Repartidor</label>
              <select
                value={deliveryForm.driver_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, driver_id: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm bg-white"
                required
              >
                <option value="">-- Seleccionar domiciliario --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) {d.phone ? `· ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No hay domiciliarios activos registrados en el sistema.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vehículo (opcional)</label>
              <select
                value={deliveryForm.vehicle_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicle_id: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Sin vehículo asignado --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate}) · {v.type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha y hora programada</label>
              <input
                type="datetime-local"
                value={deliveryForm.scheduled_time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, scheduled_time: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createDelivery}
              disabled={!deliveryForm.driver_id}
              className="w-full rounded bg-brand py-2 text-white font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              Asignar y Notificar Domiciliario
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}