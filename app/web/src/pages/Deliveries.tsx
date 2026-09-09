import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Delivery, Vehicle } from '../types';
import { DELIVERY_STATUS, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { getSocket } from '../lib/socket';
import { CircleMarker, MapContainer, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type PositionEvent = { delivery_id: number; lat: number; lng: number; speed?: number | null };
const DELIVERY_STORAGE_KEY = 'zupply_deliveries_route_v2';

// Fórmula de Haversine para calcular distancia en kilómetros entre dos coordenadas GPS
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatEta(km: number, speed?: number | null): string {
  const effectiveSpeed = speed && speed > 5 ? speed : 25; // 25 km/h promedio en ciudad
  const minutes = Math.max(1, Math.round((km / effectiveSpeed) * 60));
  return `~${minutes} min`;
}

function driverPositionFor(delivery: Delivery, myCoords?: { lat: number; lng: number } | null, isMyDelivery = false) {
  if (isMyDelivery && myCoords) return myCoords;
  const lat = Number(delivery.vehicle_lat);
  const lng = Number(delivery.vehicle_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) return { lat, lng };
  // Coordenadas base en Bucaramanga si aún no hay transmisión GPS
  return { lat: 7.1193 + (delivery.id % 5) * 0.003, lng: -73.1227 + (delivery.id % 4) * 0.003 };
}

function destinationPositionFor(delivery: Delivery) {
  const lat = Number(delivery.dest_lat);
  const lng = Number(delivery.dest_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) return { lat, lng };
  // Destino predeterminado en Bucaramanga
  return { lat: 7.1265 + (delivery.id % 3) * 0.004, lng: -73.1180 + (delivery.id % 3) * 0.003 };
}

// Componente para centrar el mapa suavemente cuando cambia la entrega seleccionada
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

function LiveMap({
  deliveries,
  selected,
  onSelect,
  myCoords,
  isDriver,
  liveSpeed,
}: {
  deliveries: Delivery[];
  selected: Delivery | null;
  onSelect: (delivery: Delivery) => void;
  myCoords: { lat: number; lng: number } | null;
  isDriver: boolean;
  liveSpeed: number | null;
}) {
  const active = deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido');

  // Si hay una entrega seleccionada, calculamos la línea de proximidad DiDi
  const activeTarget = selected || (isDriver && active.length > 0 ? active[0] : null);

  const proximityData = useMemo(() => {
    if (!activeTarget) return null;
    const isMy = isDriver && (activeTarget.driver_id != null || active.length > 0);
    const driverPos = driverPositionFor(activeTarget, myCoords, isMy);
    const destPos = destinationPositionFor(activeTarget);
    const distKm = calculateDistanceKm(driverPos.lat, driverPos.lng, destPos.lat, destPos.lng);
    return {
      driverPos,
      destPos,
      distKm,
      route: [
        [driverPos.lat, driverPos.lng] as [number, number],
        [destPos.lat, destPos.lng] as [number, number],
      ],
    };
  }, [activeTarget, myCoords, isDriver, active.length]);

  const mapCenter: [number, number] = proximityData
    ? [proximityData.driverPos.lat, proximityData.driverPos.lng]
    : [7.1193, -73.1227];

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-300 shadow-md">
      <MapContainer center={mapCenter} zoom={14} className="h-[420px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {proximityData && <MapRecenter center={[proximityData.driverPos.lat, proximityData.driverPos.lng]} />}

        {/* Línea de proximidad estilo DiDi / Rappi entre el domiciliario y el destino */}
        {proximityData && (
          <>
            <Polyline
              positions={proximityData.route}
              pathOptions={{ color: '#1e40af', weight: 6, opacity: 0.3 }}
            />
            <Polyline
              positions={proximityData.route}
              pathOptions={{ color: '#2563eb', weight: 4, dashArray: '8, 8', opacity: 0.95 }}
            />
          </>
        )}

        {/* Marcadores de todas las entregas activas */}
        {active.map((delivery) => {
          const isSelected = activeTarget?.id === delivery.id;
          const driverPos = driverPositionFor(delivery, myCoords, isDriver);
          const destPos = destinationPositionFor(delivery);

          return (
            <div key={delivery.id}>
              {/* Marcador del Domiciliario (🛵) */}
              <CircleMarker
                center={[driverPos.lat, driverPos.lng]}
                radius={isSelected ? 13 : 9}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#2563eb',
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => onSelect(delivery) }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-blue-700">🛵 Repartidor en ruta</p>
                    <p className="font-semibold">{delivery.driver_name || 'Sin asignar'}</p>
                    <p>Pedido: {delivery.order_code}</p>
                    {liveSpeed != null && <p>Velocidad: {liveSpeed} km/h</p>}
                  </div>
                </Popup>
              </CircleMarker>

              {/* Marcador de Destino (📍) */}
              {isSelected && (
                <CircleMarker
                  center={[destPos.lat, destPos.lng]}
                  radius={12}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 3,
                    fillColor: '#059669',
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-emerald-700">📍 Destino de Entrega</p>
                      <p className="font-semibold">{delivery.restaurant_name}</p>
                      <p className="text-slate-600">{delivery.delivery_address}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Tarjeta flotante superior tipo DiDi / Uber Eats con línea de proximidad */}
      {activeTarget && proximityData && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-sm rounded-xl bg-slate-900/90 p-3 text-white shadow-xl backdrop-blur-md z-[1000] border border-white/10">
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              RUTA DE PROXIMIDAD ACTIVA
            </span>
            <span className="text-[11px] text-slate-400 font-mono">{activeTarget.order_code}</span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Distancia al destino:</p>
              <p className="text-lg font-extrabold text-blue-400">
                {formatDistance(proximityData.distKm)}
                <span className="ml-2 text-xs font-normal text-slate-300">
                  ({formatEta(proximityData.distKm, liveSpeed)})
                </span>
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${proximityData.destPos.lat},${proximityData.destPos.lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow flex items-center gap-1"
              title="Abrir navegación en Google Maps"
            >
              🧭 Navegar
            </a>
          </div>

          <div className="mt-2 text-xs text-slate-300 truncate">
            <b>Entrega:</b> {activeTarget.restaurant_name} · {activeTarget.delivery_address}
          </div>
        </div>
      )}

      {/* Estado inferior de pedidos activos */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs shadow-md border z-[1000] flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="font-semibold text-slate-800">{active.length} entrega(s) en ruta</span>
      </div>

      {active.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/70 z-[999] pointer-events-none">
          <p className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow border">
            No hay entregas activas en este momento.
          </p>
        </div>
      )}
    </div>
  );
}

function loadPersistedDeliveries(): Delivery[] {
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is Delivery => Boolean(d && typeof d?.id === 'number'));
  } catch {
    return [];
  }
}

export default function Deliveries() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [deliveries, setDeliveries] = useState<Delivery[]>(loadPersistedDeliveries);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [modalVehicle, setModalVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string }[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ name: '', plate: '', type: 'moto', driver_name: '', imei: '' });

  // Telemetría GPS en tiempo real
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'activo' | 'inactivo' | 'pendiente' | 'error'>('inactivo');
  const [gpsManualEnabled, setGpsManualEnabled] = useState(true);

  // Modal para confirmar entrega con código
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');

  // Modal para asignar domiciliario (rol proveedor)
  const [assignModal, setAssignModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  const isSupplier = user?.role === 'proveedor_admin';
  const isDriver = user?.role === 'domiciliario';

  useEffect(() => {
    localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(deliveries));
  }, [deliveries]);

  const load = () => {
    api<Delivery[]>('/deliveries')
      .then((next) => {
        const normalized = Array.isArray(next) ? next.filter((d): d is Delivery => Boolean(d && typeof d?.id === 'number')) : [];
        setDeliveries(normalized);
        localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(normalized));
        if (normalized.length > 0 && !selected) {
          setSelected(normalized[0]);
        }
      })
      .catch((err) => {
        console.error(err);
        const stored = loadPersistedDeliveries();
        if (stored.length) setDeliveries(stored);
      });

    if (isSupplier) {
      api<Vehicle[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
      api<{ id: number; name: string; username: string; phone?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;

    const onPosition = (event: PositionEvent) => {
      setLiveSpeed(event.speed ?? null);
      setDeliveries((current) =>
        current.map((delivery) =>
          delivery.id === event.delivery_id
            ? {
                ...delivery,
                vehicle_lat: event.lat,
                vehicle_lng: event.lng,
                last_location_update: new Date().toISOString(),
              }
            : delivery
        )
      );
    };

    const onStatus = () => load();
    socket.on('delivery:position', onPosition);
    socket.on('delivery:status', onStatus);

    return () => {
      socket.off('delivery:position', onPosition);
      socket.off('delivery:status', onStatus);
    };
  }, []);

  // Rastreo GPS en tiempo real para el domiciliario
  useEffect(() => {
    if (!isDriver || !gpsManualEnabled || !navigator.geolocation) {
      if (!isDriver) setGpsStatus('inactivo');
      return;
    }

    setGpsStatus('pendiente');

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsStatus('activo');
        setMyCoords({ lat: coords.latitude, lng: coords.longitude });
        setGpsAccuracy(Math.round(coords.accuracy));
        const speedKmh = coords.speed == null ? null : Math.round(coords.speed * 3.6);
        setLiveSpeed(speedKmh);

        // Si hay una entrega activa asignada a este domiciliario, enviamos coordenadas a la API
        const myActiveDelivery = deliveries.find(
          (d) => d.status !== 'entregado' && d.status !== 'fallido' && (d.driver_id === user?.id || !d.driver_id)
        );

        if (myActiveDelivery) {
          api(`/deliveries/${myActiveDelivery.id}/position`, {
            method: 'PATCH',
            body: JSON.stringify({
              lat: coords.latitude,
              lng: coords.longitude,
              speed: speedKmh,
            }),
          }).catch(() => undefined);
        }
      },
      (err) => {
        console.warn('[GPS] Error obteniendo ubicación:', err);
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isDriver, gpsManualEnabled, deliveries, user?.id]);

  const changeStatus = async (id: number, status: string) => {
    try {
      await api(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      push({ message: `Estado de entrega actualizado → ${status}`, at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const confirmDelivery = async () => {
    if (!selected) return;
    try {
      await api(`/deliveries/${selected.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmation_code: confirmCode }),
      });
      push({ message: '¡Entrega confirmada y completada exitosamente!', at: new Date().toISOString() });
      setConfirmModal(false);
      setConfirmCode('');
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const assignDriver = async () => {
    if (!selected || !selectedDriverId) return;
    try {
      await api(`/deliveries/${selected.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: Number(selectedDriverId) }),
      });
      push({ message: 'Domiciliario asignado exitosamente', at: new Date().toISOString() });
      setAssignModal(false);
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

  const activeDeliveries = deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido');

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ruta GPS y Entregas</h2>
          <p className="text-sm text-slate-500">
            {isDriver
              ? 'Monitoreo en vivo tipo DiDi con línea de proximidad hacia tu entrega'
              : 'Seguimiento y telemetría de entregas en tiempo real'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Panel GPS para Domiciliarios */}
          {isDriver && (
            <button
              onClick={() => setGpsManualEnabled(!gpsManualEnabled)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                gpsStatus === 'activo'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : gpsStatus === 'pendiente'
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  gpsStatus === 'activo'
                    ? 'bg-emerald-500 animate-pulse'
                    : gpsStatus === 'pendiente'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              {gpsStatus === 'activo'
                ? `GPS Activo ${gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}`
                : gpsStatus === 'pendiente'
                ? 'Conectando GPS...'
                : 'Activar GPS'}
            </button>
          )}

          {isSupplier && (
            <button
              onClick={() => setModalVehicle(true)}
              className="rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-dark"
            >
              + Vehículo
            </button>
          )}
        </div>
      </div>

      {/* Mapa en Vivo con línea de proximidad DiDi */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <LiveMap
          deliveries={deliveries}
          selected={selected}
          onSelect={setSelected}
          myCoords={myCoords}
          isDriver={isDriver}
          liveSpeed={liveSpeed}
        />

        {/* Lista lateral de entregas activas */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Entregas Asignadas</h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {activeDeliveries.length} activa(s)
              </span>
            </div>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {activeDeliveries.map((delivery, index) => {
                const isCurrent = selected?.id === delivery.id;
                const st = DELIVERY_STATUS[delivery.status] ?? DELIVERY_STATUS.asignado;

                return (
                  <button
                    key={delivery.id}
                    onClick={() => setSelected(delivery)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isCurrent
                        ? 'border-brand bg-blue-50/80 ring-2 ring-brand/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900">
                        {index + 1}. {delivery.order_code}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-700 truncate">
                      {delivery.restaurant_name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      📍 {delivery.delivery_address || 'Sin dirección especificada'}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{delivery.driver_name ? `🛵 ${delivery.driver_name}` : '⚠️ Sin domiciliario'}</span>
                      {delivery.vehicle_name && <span>{delivery.vehicle_name}</span>}
                    </div>
                  </button>
                );
              })}

              {activeDeliveries.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">
                  No tienes entregas pendientes en este momento.
                </div>
              )}
            </div>
          </div>

          {/* Acciones directas para el domiciliario o proveedor */}
          {selected && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Acciones para {selected.order_code}:
              </p>

              {/* Botones del Domiciliario */}
              {isDriver && (
                <div className="grid grid-cols-2 gap-2">
                  {selected.status === 'asignado' && (
                    <button
                      onClick={() => changeStatus(selected.id, 'en_camino')}
                      className="col-span-2 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                    >
                      🚀 Iniciar Viaje (En Camino)
                    </button>
                  )}
                  {selected.status === 'en_camino' && (
                    <button
                      onClick={() => changeStatus(selected.id, 'llegando')}
                      className="col-span-2 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white shadow hover:bg-amber-600"
                    >
                      🛵 Estoy Llegando al Destino
                    </button>
                  )}
                  {selected.status !== 'entregado' && (
                    <button
                      onClick={() => setConfirmModal(true)}
                      className="col-span-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                    >
                      📦 Confirmar Entrega (Código)
                    </button>
                  )}
                </div>
              )}

              {/* Botones del Proveedor */}
              {isSupplier && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssignModal(true)}
                    className="flex-1 rounded-xl border border-brand py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white"
                  >
                    Asignar Repartidor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vehículos registrados (rol proveedor) */}
      {isSupplier && vehicles.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold text-slate-800 text-sm">Flota de Vehículos Registrados</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {vehicles.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm">
                <p className="font-bold text-slate-800">{v.name}</p>
                <p className="text-xs text-slate-500">{v.plate} · {v.type} · {v.driver_name ?? 'Sin conductor'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Estado: {v.status} · GPS: {v.gps_validated ? 'Validado' : 'Pendiente'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial completo de entregas */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-bold text-slate-800 text-sm">Historial General de Entregas</h3>
        <div className="divide-y divide-slate-100">
          {deliveries.map((d) => {
            const st = DELIVERY_STATUS[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition"
              >
                <div>
                  <p className="font-bold text-sm text-slate-900">
                    {d.delivery_code} <span className="font-normal text-slate-500">· Pedido {d.order_code}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {d.restaurant_name} · {d.delivery_address}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {d.driver_name ? `Conductor: ${d.driver_name}` : 'Sin conductor'}
                    {d.vehicle_name ? ` · Vehículo: ${d.vehicle_name} (${d.plate})` : ''}
                    {d.scheduled_time ? ` · Programada: ${formatDate(d.scheduled_time)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.color}`}>{st.label}</span>
                  {d.confirmation_code && (isSupplier || user?.role === 'gerente') && (
                    <p className="mt-1 text-xs text-slate-500 font-mono">
                      Código: <b>{d.confirmation_code}</b>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para confirmar entrega con código (Domiciliario) */}
      {confirmModal && selected && (
        <Modal title={`Confirmar Entrega ${selected.order_code}`} onClose={() => setConfirmModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Solicita al cliente/restaurante el <b>código de confirmación de 4 dígitos</b> generado para este pedido:
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Código de confirmación:</label>
              <input
                type="text"
                maxLength={4}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="Ej: 4821"
                className="w-full rounded-xl border px-3 py-2 text-center text-xl font-mono tracking-widest font-bold"
                required
              />
            </div>
            <button
              onClick={confirmDelivery}
              disabled={confirmCode.length < 4}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Validar y Finalizar Entrega
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para asignar repartidor (Proveedor) */}
      {assignModal && selected && (
        <Modal title={`Asignar Domiciliario a ${selected.order_code}`} onClose={() => setAssignModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Seleccionar Domiciliario:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Elige un domiciliario --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={assignDriver}
              disabled={!selectedDriverId}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Asignar y Notificar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para nuevo vehículo */}
      {modalVehicle && (
        <Modal title="Nuevo vehículo" onClose={() => setModalVehicle(false)}>
          <div className="space-y-3">
            <input
              value={vehicleForm.name}
              onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
              placeholder="Nombre (ej: Moto 1)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={vehicleForm.plate}
              onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
              placeholder="Placa (ej: ABC-123)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <select
              value={vehicleForm.type}
              onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="moto">Moto</option>
              <option value="furgon">Furgón</option>
              <option value="camion">Camión</option>
              <option value="camioneta">Camioneta</option>
            </select>
            <input
              value={vehicleForm.driver_name}
              onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
              placeholder="Conductor predeterminado"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={vehicleForm.imei}
              onChange={(e) => setVehicleForm({ ...vehicleForm, imei: e.target.value })}
              placeholder="IMEI del GPS (15 dígitos, opcional)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              onClick={createVehicle}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Guardar vehículo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}