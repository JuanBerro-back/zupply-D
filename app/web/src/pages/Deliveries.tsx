import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getExactLocation, watchExactLocation, requestLocationPermissions } from '../lib/location';
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
  if (myCoords) return myCoords;
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

// Componente para centrar el mapa suavemente cuando cambian las coordenadas
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Botón flotante dentro del mapa para centrar en la ubicación actual del usuario
function RecenterControl({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  if (!target) return null;
  return (
    <div className="leaflet-top leaflet-right !mt-3 !mr-3 z-[999] pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          map.setView([target.lat, target.lng], 16, { animate: true });
        }}
        className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-blue-700 shadow-lg border border-blue-200 hover:bg-blue-50 active:scale-95 transition backdrop-blur-sm cursor-pointer"
        title="Centrar mapa en mi ubicación actual"
      >
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Mi Ubicación</span>
      </button>
    </div>
  );
}

function LiveMap({
  deliveries,
  selected,
  onSelect,
  myCoords,
  isDriver,
  liveSpeed,
  gpsAccuracy,
}: {
  deliveries: Delivery[];
  selected: Delivery | null;
  onSelect: (delivery: Delivery) => void;
  myCoords: { lat: number; lng: number } | null;
  isDriver: boolean;
  liveSpeed: number | null;
  gpsAccuracy: number | null;
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
    : myCoords
    ? [myCoords.lat, myCoords.lng]
    : [7.1193, -73.1227];

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-300 shadow-md">
      <MapContainer center={mapCenter} zoom={15} className="h-[420px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {proximityData ? (
          <MapRecenter center={[proximityData.driverPos.lat, proximityData.driverPos.lng]} />
        ) : myCoords ? (
          <MapRecenter center={[myCoords.lat, myCoords.lng]} />
        ) : null}

        <RecenterControl target={myCoords} />

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

        {/* Marcador de Mi Ubicación Actual (Exactitud GPS en tiempo real) */}
        {myCoords && (
          <>
            {/* Halo de precisión GPS en metros */}
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={Math.min(Math.max((gpsAccuracy || 20) / 2, 12), 50)}
              pathOptions={{
                color: '#2563eb',
                weight: 1.5,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                dashArray: '3, 3',
              }}
            />

            {/* Punto azul de usuario con borde blanco estilo Google Maps / DiDi */}
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#2563eb',
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="text-xs p-1">
                  <p className="font-bold text-blue-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                    <span>Mi Posición Actual</span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {myCoords.lat.toFixed(6)}, {myCoords.lng.toFixed(6)}
                  </p>
                  {gpsAccuracy != null && (
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      Exactitud GPS: ±{gpsAccuracy}m
                    </p>
                  )}
                  {liveSpeed != null && liveSpeed > 0 && (
                    <p className="text-[11px] text-slate-700">
                      Velocidad: {liveSpeed} km/h
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Marcadores de todas las entregas activas */}
        {active.map((delivery) => {
          const isSelected = activeTarget?.id === delivery.id;
          const driverPos = driverPositionFor(delivery, myCoords, isDriver);
          const destPos = destinationPositionFor(delivery);

          return (
            <div key={delivery.id}>
              {/* Marcador del Domiciliario */}
              <CircleMarker
                center={[driverPos.lat, driverPos.lng]}
                radius={isSelected ? 13 : 9}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#0284c7',
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => onSelect(delivery) }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-sky-700">Repartidor en ruta</p>
                    <p className="font-semibold">{delivery.driver_name || 'Sin asignar'}</p>
                    <p>Pedido: {delivery.order_code}</p>
                    {liveSpeed != null && <p>Velocidad: {liveSpeed} km/h</p>}
                  </div>
                </Popup>
              </CircleMarker>

              {/* Marcador de Destino */}
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
                      <p className="font-bold text-emerald-700">Destino de Entrega</p>
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
              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow flex items-center gap-1.5"
              title="Abrir navegación en Google Maps"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Navegar</span>
            </a>
          </div>

          <div className="mt-2 text-xs text-slate-300 truncate">
            <b>Entrega:</b> {activeTarget.restaurant_name} · {activeTarget.delivery_address}
          </div>
        </div>
      )}

      {/* Estado inferior de pedidos activos */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs shadow-md border z-[1000] flex items-center gap-2">
        {active.length > 0 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-slate-800">{active.length} entrega(s) en ruta</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="font-semibold text-slate-700">0 entregas asignadas · GPS en vivo</span>
          </>
        )}
      </div>
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
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
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
  const canManage = isSupplier || user?.role === 'admin' || user?.role === 'gerente';

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

    if (canManage) {
      api<Vehicle[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
      api<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
      api<any[]>('/orders').then((allOrders) => {
        if (Array.isArray(allOrders)) {
          setPendingOrders(allOrders.filter((o) => !['entregado', 'cancelado'].includes(o.status)));
        }
      }).catch(() => undefined);
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

  const refreshGps = async () => {
    setGpsManualEnabled(true);
    setGpsStatus('pendiente');
    try {
      await requestLocationPermissions();
      const loc = await getExactLocation();
      if (loc) {
        setMyCoords({ lat: loc.lat, lng: loc.lng });
        setGpsAccuracy(loc.accuracy);
        setLiveSpeed(loc.speed ?? null);
        setGpsStatus('activo');
        push({
          message: `GPS sincronizado (Precisión: ±${loc.accuracy}m)`,
          at: new Date().toISOString(),
        });
      } else {
        setGpsStatus('error');
        push({
          message: 'No se pudo obtener la posición GPS exacta. Activa la ubicación de tu teléfono.',
          at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[GPS] Error en refreshGps:', e);
      setGpsStatus('error');
    }
  };

  // Rastreo GPS en tiempo real de alta exactitud (Capacitor nativo FusedLocation / Navegador)
  useEffect(() => {
    if (!gpsManualEnabled) {
      setGpsStatus('inactivo');
      return;
    }

    let isMounted = true;
    setGpsStatus('pendiente');

    // 1. Obtener ubicación precisa inicial inmediata
    getExactLocation().then((loc) => {
      if (!isMounted || !loc) return;
      setMyCoords({ lat: loc.lat, lng: loc.lng });
      setGpsAccuracy(loc.accuracy);
      setLiveSpeed(loc.speed ?? null);
      setGpsStatus('activo');
    });

    // 2. Transmisión continua en tiempo real con alta exactitud
    const unwatch = watchExactLocation(
      (loc) => {
        if (!isMounted) return;
        setMyCoords({ lat: loc.lat, lng: loc.lng });
        setGpsAccuracy(loc.accuracy);
        setLiveSpeed(loc.speed ?? null);
        setGpsStatus('activo');

        // Si el usuario es domiciliario y tiene entrega activa, reporta telemetría al servidor
        if (isDriver) {
          const myActiveDelivery = deliveries.find(
            (d) => d.status !== 'entregado' && d.status !== 'fallido' && (d.driver_id === user?.id || !d.driver_id)
          );

          if (myActiveDelivery) {
            api(`/deliveries/${myActiveDelivery.id}/position`, {
              method: 'PATCH',
              body: JSON.stringify({
                lat: loc.lat,
                lng: loc.lng,
                speed: loc.speed,
              }),
            }).catch(() => undefined);
          }
        }
      },
      (err) => {
        console.warn('[GPS] Error de seguimiento:', err);
        if (isMounted) setGpsStatus('error');
      }
    );

    return () => {
      isMounted = false;
      unwatch();
    };
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
          {/* Botón de estado GPS y calibración de alta exactitud */}
          <button
            type="button"
            onClick={refreshGps}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition active:scale-95 ${
              gpsStatus === 'activo'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : gpsStatus === 'pendiente'
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
            title="Haga clic para sincronizar o recalibrar la posición GPS con alta exactitud"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                gpsStatus === 'activo'
                  ? 'bg-emerald-500 animate-pulse'
                  : gpsStatus === 'pendiente'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            {gpsStatus === 'activo'
              ? `GPS Activo ${gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}`
              : gpsStatus === 'pendiente'
              ? 'Conectando GPS...'
              : 'Reconectar GPS'}
          </button>

          {isSupplier && (
            <button
              onClick={() => setModalVehicle(true)}
              className="rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-dark active:scale-95"
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
          gpsAccuracy={gpsAccuracy}
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
                      {delivery.delivery_address || 'Sin dirección especificada'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <span>{delivery.driver_name ? delivery.driver_name : 'Sin domiciliario'}</span>
                      <div className="flex items-center gap-1">
                        {delivery.vehicle_name && <span className="text-slate-400">{delivery.vehicle_name}</span>}
                        {canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(delivery);
                              setSelectedDriverId(delivery.driver_id ? String(delivery.driver_id) : '');
                              setAssignModal(true);
                            }}
                            className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            {delivery.driver_name ? 'Cambiar' : 'Asignar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {activeDeliveries.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500 space-y-3">
                  <p className="font-medium">No tienes entregas en ruta en este momento.</p>
                  {pendingOrders.length > 0 && canManage && (
                    <div className="text-left space-y-2 border-t pt-3">
                      <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>Pedidos listos para asignar entrega:</span>
                      </p>
                      <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                        {pendingOrders.map((po) => (
                          <div
                            key={po.id}
                            className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/90 flex items-center justify-between text-xs hover:bg-slate-100 transition shadow-sm"
                          >
                            <div className="truncate pr-2">
                              <span className="font-bold text-slate-900">{po.order_code}</span>
                              <p className="text-slate-500 text-[11px] truncate">{po.restaurant_name}</p>
                            </div>
                            <Link
                              to={`/pedidos/${po.id}`}
                              className="rounded-lg bg-brand px-2.5 py-1 text-white font-bold text-[11px] hover:bg-brand-dark shadow-sm shrink-0"
                            >
                              Asignar
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                      Iniciar Viaje (En Camino)
                    </button>
                  )}
                  {selected.status === 'en_camino' && (
                    <button
                      onClick={() => changeStatus(selected.id, 'llegando')}
                      className="col-span-2 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white shadow hover:bg-amber-600"
                    >
                      Estoy Llegando al Destino
                    </button>
                  )}
                  {selected.status !== 'entregado' && (
                    <button
                      onClick={() => setConfirmModal(true)}
                      className="col-span-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                    >
                      Confirmar Entrega (Código)
                    </button>
                  )}
                </div>
              )}

              {/* Botones del Proveedor o Gerente */}
              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedDriverId(selected.driver_id ? String(selected.driver_id) : '');
                      setAssignModal(true);
                    }}
                    className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 transition"
                  >
                    Asignar / Cambiar Repartidor
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

      {/* Modal para asignar repartidor (Proveedor / Gerente / Admin) */}
      {assignModal && selected && (
        <Modal title={`Asignar Domiciliario a ${selected.order_code}`} onClose={() => setAssignModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar Domiciliario / Conductor:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
              >
                <option value="">-- Elige un usuario del sistema --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'} {d.phone ? `· Tel: ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No se encontraron usuarios registrados en el sistema.</p>
              )}
            </div>
            <button
              onClick={assignDriver}
              disabled={!selectedDriverId}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50 shadow transition"
            >
              Asignar y Notificar al Domiciliario
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para nuevo vehículo */}
      {modalVehicle && (
        <Modal title="Registrar Nuevo Vehículo" onClose={() => setModalVehicle(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nombre o Identificador:</label>
              <input
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                placeholder="Ej: Moto Domicilios 1, Furgón Norte"
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Placa:</label>
              <input
                value={vehicleForm.plate}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                placeholder="Ej: ABC-123"
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Tipo de Vehículo:</label>
              <select
                value={vehicleForm.type}
                onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="moto">Moto</option>
                <option value="furgon">Furgón</option>
                <option value="camion">Camión</option>
                <option value="camioneta">Camioneta</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Conductor Asignado:</label>
              <select
                value={vehicleForm.driver_name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Seleccionar de los usuarios registrados --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'}
                  </option>
                ))}
              </select>
              <input
                value={vehicleForm.driver_name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                placeholder="O escribir nombre manualmente si no está en la lista"
                className="w-full rounded-xl border px-3 py-1.5 text-xs text-slate-600 mt-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">IMEI del GPS (opcional):</label>
              <input
                value={vehicleForm.imei}
                onChange={(e) => setVehicleForm({ ...vehicleForm, imei: e.target.value })}
                placeholder="IMEI del GPS (15 dígitos, opcional)"
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createVehicle}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark shadow transition"
            >
              Guardar vehículo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}