import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Invoice, Order } from '../types';
import { INVOICE_STATUS, formatMoney, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';

interface Row {
  description: string;
  quantity: string;
  unit_price: string;
}

export default function Invoices() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [modal, setModal] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ description: '', quantity: '1', unit_price: '0' }]);
  const [form, setForm] = useState({
    order_id: '',
    client_name: '',
    client_email: '',
    payment_method: 'Efectivo',
  });

  const load = () => {
    api<Invoice[]>('/invoices').then(setInvoices).catch(console.error);
    api<Order[]>('/orders?status=entregado').then(setOrders).catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    try {
      const items = rows
        .filter((r) => r.description.trim())
        .map((r) => ({ description: r.description, quantity: Number(r.quantity), unit_price: Number(r.unit_price) }));
      if (items.length === 0) return alert('Agrega al menos un ítem');
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          order_id: form.order_id ? Number(form.order_id) : null,
          client_name: form.client_name,
          client_email: form.client_email,
          payment_method: form.payment_method,
          items,
        }),
      });
      push({ message: 'Factura emitida', at: new Date().toISOString() });
      setModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const changeStatus = async (id: number, status: string) => {
    try {
      await api(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const input = 'w-full rounded border px-3 py-2 text-sm';
  const invoiceMode = user?.role === 'proveedor_admin';

  if (invoiceMode) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">Facturación</h2>
        <p className="text-sm text-gray-600">Las facturas las emiten los restaurantes. Aquí puedes consultarlas.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500"><th className="px-3 py-2">Factura</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Estado</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b">
                  <td className="px-3 py-2">{inv.invoice_code}</td>
                  <td className="px-3 py-2">{inv.client_name ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(inv.total)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${INVOICE_STATUS[inv.status]?.color ?? ''}`}>
                      {INVOICE_STATUS[inv.status]?.label ?? inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Facturación electrónica</h2>
        <button onClick={() => setModal(true)} className="rounded bg-brand px-4 py-2 text-sm text-white">+ Nueva factura</button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Factura</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="px-3 py-2 text-right">IVA</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="px-3 py-2">{inv.invoice_code}</td>
                <td className="px-3 py-2">{inv.client_name ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatMoney(inv.subtotal)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(inv.iva_amount)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(inv.total)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${INVOICE_STATUS[inv.status]?.color ?? ''}`}>
                    {INVOICE_STATUS[inv.status]?.label ?? inv.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{formatDate(inv.created_at)}</td>
                <td className="px-3 py-2">
                  {inv.status === 'emitida' && (
                    <button onClick={() => changeStatus(inv.id, 'pagada')} className="rounded border border-green-600 px-2 py-1 text-xs text-green-600">Marcar pagada</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Nueva factura" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Pedido (opcional)</label>
              <select value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} className={input}>
                <option value="">Sin pedido asociado</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.order_code} · {formatMoney(o.total)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente</label>
                <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email (para enviar)</label>
                <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className={input} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Método de pago</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                {['Efectivo', 'Tarjeta', 'Nequi', 'PSE', 'Daviplata', 'Credito'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <input value={r.description} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Descripción" className={input} />
                  <input type="number" value={r.quantity} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} className={input} />
                  <input type="number" value={r.unit_price} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} className={input} />
                </div>
              ))}
              <button onClick={() => setRows([...rows, { description: '', quantity: '1', unit_price: '0' }])} className="text-sm text-brand">+ Agregar ítem</button>
            </div>
            <button onClick={submit} className="w-full rounded bg-brand py-2 text-white">Emitir factura</button>
          </div>
        </Modal>
      )}
    </div>
  );
}