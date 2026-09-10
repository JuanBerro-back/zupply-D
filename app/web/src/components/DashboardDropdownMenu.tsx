import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { getPlanDetails } from '../lib/planAccess';
import {
  IconDashboard,
  IconCatalog,
  IconOrders,
  IconCart,
  IconInventory,
  IconGps,
  IconTeam,
  IconSuppliers,
  IconPlans,
  IconAi,
  IconInvoice,
  IconAccounting,
  IconLogout,
  IconClose,
  IconMenu,
} from './Icons';

interface DashboardDropdownMenuProps {
  onOpenFullDrawer?: () => void;
}

export default function DashboardDropdownMenu({ onOpenFullDrawer }: DashboardDropdownMenuProps) {
  const { user, tenant, logout } = useAuth();
  const { count, openCart } = useCart();
  const { lang, t } = useLanguage();
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
          <IconDashboard className="w-4 h-4 text-emerald-300 dark:text-emerald-400" />
          <span className="font-extrabold tracking-tight">{t('nav.dropdown_dashboard')}</span>
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

      {/* Menú Desplegable tipo Dashboard */}
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
                  <IconDashboard className="w-6 h-6" />
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
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {/* Módulos Adaptados por Rol */}
            <div className="space-y-3 text-xs">
              {/* Sección 1: Operaciones Principales */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  {lang === 'es' ? 'Operaciones del Panel' : 'Panel Operations'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition">
                      <IconDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.dashboard')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Resumen general' : 'Overview metrics'}</p>
                    </div>
                  </Link>

                  {!isDomiciliario && (
                    <Link
                      to="/catalogo"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                    >
                      <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                        <IconCatalog className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.catalog')}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Insumos mayoristas' : 'B2B Supplies'}</p>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/pedidos"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
                      <IconOrders className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.orders')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Despachos y estados' : 'Track orders'}</p>
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
                      <div className="h-8 w-8 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition">
                        <IconCart className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.cart')}</p>
                          {count > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                              {count}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Insumos listos' : 'Ready items'}</p>
                      </div>
                    </button>
                  )}

                  {(isSupplier || isDomiciliario || isAdmin) && (
                    <Link
                      to="/logistica"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-sky-100 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition group"
                    >
                      <div className="h-8 w-8 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition">
                        <IconGps className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sky-900 dark:text-sky-200 leading-tight">{t('nav.deliveries')}</p>
                        <p className="text-[10px] text-sky-600 dark:text-sky-400">{lang === 'es' ? 'Rutas satelitales' : 'Live GPS routes'}</p>
                      </div>
                    </Link>
                  )}

                  {!isSupplier && !isDomiciliario && (
                    <Link
                      to="/inventario"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                    >
                      <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
                        <IconInventory className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.inventory')}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Control de stock' : 'Reorder alerts'}</p>
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* Sección 2: Gestión, Personas & Finanzas */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  {lang === 'es' ? 'Gestión & Automatización' : 'Management & Automation'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(isGerente || isSupplier || isAdmin) && (
                    <Link
                      to="/equipo"
                      onClick={closeAndNavigate}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition group"
                    >
                      <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition">
                        <IconTeam className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-purple-900 dark:text-purple-200 leading-tight">
                          {isSupplier ? (lang === 'es' ? 'Flota Domiciliarios' : 'Driver Fleet') : (lang === 'es' ? 'Equipo Empleados' : 'Staff Team')}
                        </p>
                        <p className="text-[10px] text-purple-600 dark:text-purple-400">
                          {isSupplier ? (lang === 'es' ? 'Vehículos & rutas' : 'Vehicles & plates') : (lang === 'es' ? 'Personal operativo' : 'Kitchen staff')}
                        </p>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/proveedores"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-105 transition">
                      <IconSuppliers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.suppliers')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Directorio y galería' : 'Verified network'}</p>
                    </div>
                  </Link>

                  <Link
                    to="/planes"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
                      <IconPlans className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200 leading-tight">{t('nav.plans')}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">{lang === 'es' ? 'Beneficios y nivel' : 'Tier & features'}</p>
                    </div>
                  </Link>

                  <Link
                    to="/zupply-ia"
                    onClick={closeAndNavigate}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                      <IconAi className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-indigo-900 dark:text-indigo-200 leading-tight">{t('nav.ai')}</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">{lang === 'es' ? 'Asesor 24/7' : '24/7 Copilot'}</p>
                    </div>
                  </Link>

                  {(isGerente || isSupplier || isAdmin) && (
                    <>
                      <Link
                        to="/facturacion"
                        onClick={closeAndNavigate}
                        className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                      >
                        <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition">
                          <IconInvoice className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.invoices')}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Normativa DIAN' : 'Legal compliance'}</p>
                        </div>
                      </Link>

                      <Link
                        to="/contabilidad"
                        onClick={closeAndNavigate}
                        className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                      >
                        <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
                          <IconAccounting className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">{t('nav.accounting')}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{lang === 'es' ? 'Costeo PEPS' : 'FIFO costing'}</p>
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
                <IconMenu className="w-4 h-4" />
                <span>{t('nav.full_drawer')}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-bold transition cursor-pointer"
              >
                <IconLogout className="w-4 h-4" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
