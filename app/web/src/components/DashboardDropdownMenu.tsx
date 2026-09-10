import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getPlanDetails } from '../lib/planAccess';

interface DashboardDropdownMenuProps {
  onOpenFullDrawer?: () => void;
}

export default function DashboardDropdownMenu({ onOpenFullDrawer }: DashboardDropdownMenuProps) {
  const { user, tenant, logout } = useAuth();
  const { count, openCart } = useCart();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isSupplier = user?.role === 'proveedor_admin';
  const isDomiciliario = user?.role === 'domiciliario';
  const isGerente = user?.role === 'gerente';
  const isAdmin = user?.role === 'admin';

  const planInfo = getPlanDetails();

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  const closeAndNavigate = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Disparador del Menú Desplegable tipo Dashboard */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black shadow-sm transition active:scale-95 cursor-pointer border ${
          isOpen
            ? isSupplier
              ? 'bg-emerald-800 text-white border-emerald-400'
              : 'bg-sky-900 text-white border-sky-400'
            : isSupplier
            ? 'bg-white/20 hover:bg-white/30 text-white border-white/20'
            : 'bg-white/20 hover:bg-white/30 text-white border-white/20'
        }`}
        title="Abrir Menú Desplegable Dashboard"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📊</span>
          <span className="font-extrabold tracking-tight">Dashboard</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menú Desplegable tipo Dashboard (Desktop: Dropdown flotante / Mobile: Modal centrado) */}
      {isOpen && (
        <>
          {/* Fondo móvil táctil */}
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-2xs"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed inset-x-4 top-16 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2.5 z-50 w-auto md:w-[460px] max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100`}
          >
            {/* Cabecera del Dropdown con Rol y Negocio */}
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${
                isSupplier
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100'
                  : 'bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/50 text-sky-950 dark:text-sky-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs ${
                    isSupplier ? 'bg-emerald-600 text-white' : 'bg-brand text-white'
                  }`}
                >
                  {isSupplier ? '🏢' : isDomiciliario ? '🛵' : '🍽️'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black truncate leading-tight">
                    {tenant?.name || user?.name || 'Zupply'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isSupplier
                          ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                          : 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100'
                      }`}
                    >
                      {user?.role?.replace('_', ' ')}
                    </span>
                    {!isSupplier && !isDomiciliario && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-md">
                        {planInfo.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar desplegable"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Módulos Adaptados por Rol */}
            <div className="space-y-3 text-xs">
              {/* Sección 1: Operaciones Principales */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  Operaciones del Panel
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">Inicio Dashboard</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Resumen y métricas</p>
                    </div>
                  </Link>

                  {!isDomiciliario && (
                    <Link
                      to="/catalogo"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">📦</span>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">Catálogo B2B</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Insumos mayoristas</p>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/pedidos"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">Pedidos</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Despachos y órdenes</p>
                    </div>
                  </Link>

                  {!isSupplier && !isDomiciliario && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        openCart();
                      }}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🛒</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">Carrito</p>
                          {count > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                              {count}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Insumos listos</p>
                      </div>
                    </button>
                  )}

                  {(isSupplier || isDomiciliario || isAdmin) && (
                    <Link
                      to="/logistica"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-sky-100 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🗺️</span>
                      <div>
                        <p className="font-bold text-sky-900 dark:text-sky-200 leading-tight">Mapa GPS</p>
                        <p className="text-[10px] text-sky-600 dark:text-sky-400">Rutas satelitales</p>
                      </div>
                    </Link>
                  )}

                  {!isSupplier && !isDomiciliario && (
                    <Link
                      to="/inventario"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🥦</span>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">Inventario ROP</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Control de stock</p>
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* Sección 2: Gestión, Personas & Finanzas */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  Gestión & Automatización
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(isGerente || isSupplier || isAdmin) && (
                    <Link
                      to="/equipo"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">👥</span>
                      <div>
                        <p className="font-bold text-purple-900 dark:text-purple-200 leading-tight">
                          {isSupplier ? 'Flota Domiciliarios' : 'Equipo Empleados'}
                        </p>
                        <p className="text-[10px] text-purple-600 dark:text-purple-400">
                          {isSupplier ? 'Vehículos & rutas' : 'Personal operativo'}
                        </p>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/proveedores"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">🏢</span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">Proveedores</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Directorio y galería</p>
                    </div>
                  </Link>

                  <Link
                    to="/planes"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">💎</span>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200 leading-tight">Planes Zupply</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Suscripción activa</p>
                    </div>
                  </Link>

                  <Link
                    to="/zupply-ia"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">🤖</span>
                    <div>
                      <p className="font-bold text-indigo-900 dark:text-indigo-200 leading-tight">Zupply IA</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Asistente 24/7</p>
                    </div>
                  </Link>

                  {(isGerente || isSupplier || isAdmin) && (
                    <>
                      <Link
                        to="/facturacion"
                        onClick={closeAndNavigate}
                        className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">📑</span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">Facturación</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Normativa DIAN</p>
                        </div>
                      </Link>

                      <Link
                        to="/contabilidad"
                        onClick={closeAndNavigate}
                        className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">📈</span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">Contabilidad</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Costeo PEPS</p>
                        </div>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Pie del Desplegable: Botón para Drawer Completo + Salida */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenFullDrawer) {
                    onOpenFullDrawer();
                  } else {
                    window.dispatchEvent(new Event('zupply_open_drawer'));
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                <span>☰ Menú Lateral Completo</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-bold transition cursor-pointer"
              >
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
