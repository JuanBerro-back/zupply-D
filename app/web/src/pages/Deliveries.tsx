import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Delivery, Vehicle } from '../types';
import { DELIVERY_STATUS, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { getSocket } from '../lib/socket';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type PositionEvent = { delivery_id: number; lat: number; lng: number; speed?: number | null };

function positionFor(delivery: Delivery, index: number) {
  const lat = Number(delivery.vehicle_lat);
  const lng = Number(delivery.vehicle_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: 7.1193 + (index % 4) * 0.004, lng: -73.1227 + (index % 3) * 0.005 };
}

function LiveMap({ deliveries, selectedId, onSelect }: { deliveries: Delivery[]; selectedId?: number; onSelect: (delivery: Delivery) => void }) {
  const active = deliveries.filter((delivery) => delivery.status !== 'entregado' && delivery.status !== 'fallido');
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-slate-300 shadow-inner">
      <MapContainer center={[7.1193, -73.1227]} zoom={13} className="h-[360px] w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {active.map((delivery, index) => {
          const point = positionFor(delivery, index);
          const selected = delivery.id === selectedId;
          return (
            <CircleMarker
              key={delivery.id}
              center={[point.lat, point.lng]}
              radius={selected ? 13 : 10}
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: selected ? '#d97706' : '#047857', fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onSelect(delivery) }}
            >
              <Popup>{delivery.order_code} · {delivery.driver_name ?? 'Sin domiciliario'}</Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="absolute left-5 top-5 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
        <p className="font-semibold text-slate-800">Bucaramanga · Monitoreo GPS</p>
        <p className="text-slate-500">{active.length} pedido(s) en ruta</p>
      </div>
      <div className="absolute bottom-4 left-4 rounded-lg bg-slate-900/85 px-3 py-2 text-xs text-white">
        Actualización en tiempo real
      </div>
      {active.length === 0 && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-slate-500">No hay pedidos activos en ruta.</p>}
    </div>
  );
}

export default function Deliveries() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [modalVehicle, setModalVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ name: '', plate: '', type: 'moto', driver_name: '', imei: '' });
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState('GPS inactivo');

  const isSupplier = user?.role === 'proveedor_admin';

  const load = () => {
    api<Delivery[]>('/deliveries').then(setDeliveries).catch(console.error);
    if (user?.supplier_id) {
      api<Vehicle[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const onPosition = (event: PositionEvent) => {
      setLiveSpeed(event.speed ?? null);
      setDeliveries((current) => current.map((delivery) => delivery.id === event.delivery_id
        ? { ...delivery, vehicle_lat: event.lat, vehicle_lng: event.lng, last_location_update: new Date().toISOString() }
        : delivery));
    };
    const onStatus = () => load();
    socket.on('delivery:position', onPosition);
    socket.on('delivery:status', onStatus);
    return () => {
      socket.off('delivery:position', onPosition);
      socket.off('delivery:status', onStatus);
    };
  }, []);

  useEffect(() => {
    if (user?.role !== 'domiciliario' || !navigator.geolocation) return;
    const activeDelivery = deliveries.find((delivery) => delivery.status !== 'entregado' && delivery.status !== 'fallido');
    if (!activeDelivery) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsStatus('GPS conectado');
        setLiveSpeed(coords.speed == null ? null : Math.round(coords.speed * 3.6));
        api(`/deliveries/${activeDelivery.id}/position`, {
          method: 'PATCH',
          body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude, speed: coords.speed == null ? null : coords.speed * 3.6 }),
        }).catch(() => setGpsStatus('GPS sin conexión'));
      },
      () => setGpsStatus('Permiso GPS pendiente'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.role, deliveries]);

  const changeStatus = async (id: number, status: string) => {
    try {
      await api(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      push({ message: `Entrega → ${status}`, at: new Date().toISOString() });
      setSelected(null);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const createVehicle = async () => {
    try {
      await api('/deliveries/vehicles', {
        method: 'POST',
        body: JSON.stringify(vehicleForm),
      });
      setModalVehicle(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const input = 'w-full rounded border px-3 py-2 text-sm';

  const shipperActions = ['en_camino', 'llegando', 'entregado', 'fallido'];
  const activeDeliveries = deliveries.filter((delivery) => delivery.status !== 'entregado' && delivery.status !== 'fallido');
  const selectedPosition = selected ? positionFor(selected, deliveries.indexOf(selected)) : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mapa GPS de pedidos</h2>
          <p className="text-sm text-gray-500">{user?.role === 'domiciliario' ? 'Tu ruta asignada' : 'Seguimiento en tiempo real de las entregas'}</p>
          {user?.role === 'domiciliario' && <p className="text-xs text-emerald-700">{gpsStatus}</p>}
        </div>
        {isSupplier && (
          <button onClick={() => setModalVehicle(true)} className="rounded border border-brand px-4 py-2 text-sm text-brand">
            + Vehículo
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <LiveMap deliveries={deliveries} selectedId={selected?.id} onSelect={setSelected} />
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Ruta asignada</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{activeDeliveries.length} activa(s)</span>
          </div>
          <div className="space-y-3">
            {activeDeliveries.slice(0, 4).map((delivery, index) => {
              const status = DELIVERY_STATUS[delivery.status] ?? DELIVERY_STATUS.asignado;
              return (
                <button key={delivery.id} onClick={() => setSelected(delivery)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === delivery.id ? 'border-brand bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{index + 1}. {delivery.order_code}</span>
                    <span className={`rounded-full px-2 py-1 text-[11px] ${status.color}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">{delivery.restaurant_name} · {delivery.delivery_address}</p>
                  <p className="mt-1 text-xs text-gray-400">{delivery.driver_name ?? 'Sin domiciliario'} · {delivery.vehicle_name ?? 'Sin vehículo'}</p>
                </button>
              );
            })}
            {activeDeliveries.length === 0 && <p className="text-sm text-gray-500">Sin rutas pendientes.</p>}
          </div>
        </div>
      </div>

      {selected && selectedPosition && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-slate-900 p-4 text-sm text-white md:grid-cols-5">
          <div><p className="text-slate-400">Pedido</p><p className="font-semibold">{selected.order_code}</p></div>
          <div><p className="text-slate-400">Coordenadas</p><p className="font-semibold">{selectedPosition.lat.toFixed(5)}, {selectedPosition.lng.toFixed(5)}</p></div>
          <div><p className="text-slate-400">IMEI GPS</p><p className="font-semibold">{selected.imei ?? 'No registrado'}</p></div>
          <div><p className="text-slate-400">Validación</p><p className={`font-semibold ${selected.gps_validated ? 'text-emerald-300' : 'text-amber-300'}`}>{selected.gps_validated ? 'Validado' : 'Pendiente'}</p></div>
          <div><p className="text-slate-400">Velocidad</p><p className="font-semibold">{liveSpeed == null ? 'Sin dato' : `${liveSpeed} km/h`}</p></div>
        </div>
      )}

      {isSupplier && vehicles.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-lg border bg-white p-3 text-sm">
              <p className="font-semibold">{v.name}</p>
              <p className="text-xs text-gray-500">{v.plate} · {v.type} · {v.driver_name ?? 'sin conductor'}</p>
              <p className="text-xs text-gray-400">Estado: {v.status} · GPS: {v.gps_validated ? 'validado' : 'pendiente'}</p>
              <p className="text-xs text-gray-400">IMEI: {v.imei ?? 'sin registrar'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {deliveries.map((d) => {
          const st = DELIVERY_STATUS[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700' };
          return (
            <button key={d.id} onClick={() => setSelected(d)} className="rounded-lg border bg-white p-4 text-left shadow-sm hover:shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{d.delivery_code}</p>
                  <p className="text-sm text-gray-500">{d.restaurant_name} · Pedido {d.order_code}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {d.vehicle_name ? `${d.vehicle_name} (${d.plate})` : 'Sin vehículo'} · {d.driver_name ?? 'Sin conductor'}
              </p>
            </button>
          );
        })}
        {deliveries.length === 0 && <p className="text-gray-500">Sin entregas registradas.</p>}
      </div>

      {selected && (
        <Modal title={`Entrega ${selected.delivery_code}`} onClose={() => setSelected(null)}>
          <div className="mb-3 text-sm">
            <p><b>Pedido:</b> {selected.order_code}</p>
            <p><b>Restaurante:</b> {selected.restaurant_name}</p>
            <p><b>Dirección:</b> {selected.delivery_address ?? '—'}</p>
            <p><b>Programada:</b> {formatDate(selected.scheduled_time)}</p>
            {selected.items?.length ? (
              <ul className="mt-1 list-inside list-disc">
                {selected.items.map((it) => (
                  <li key={it.id}>{it.quantity} {it.unit} · {it.product_name}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {isSupplier && selected.status !== 'entregado' && selected.status !== 'fallido' && (
            <div className="grid grid-cols-2 gap-2">
              {shipperActions.map((s) => (
                <button key={s} onClick={() => changeStatus(selected.id, s)} className="rounded border border-brand py-2 text-sm text-brand hover:bg-brand hover:text-white">
                  {DELIVERY_STATUS[s].label}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {modalVehicle && (
        <Modal title="Nuevo vehículo" onClose={() => setModalVehicle(false)}>
          <div className="space-y-3">
            <input value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} placeholder="Nombre (ej: Moto 1)" className={input} />
            <input value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })} placeholder="Placa" className={input} />
            <select value={vehicleForm.type} onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })} className={input}>
              <option value="moto">Moto</option>
              <option value="furgon">Furgón</option>
              <option value="camion">Camión</option>
              <option value="camioneta">Camioneta</option>
            </select>
            <input value={vehicleForm.driver_name} onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })} placeholder="Conductor" className={input} />
            <input value={vehicleForm.imei} onChange={(e) => setVehicleForm({ ...vehicleForm, imei: e.target.value })} placeholder="IMEI del GPS (15 dígitos)" className={input} />
            <button onClick={createVehicle} className="w-full rounded bg-brand py-2 text-white">Guardar vehículo</button>
          </div>
        </Modal>
      )}
    </div>
  );
}