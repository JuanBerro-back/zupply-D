import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';

export default function Navbar() {
  const { user, tenant, logout } = useAuth();
  const { count, openCart } = useCart();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSupplier = user?.role === 'proveedor_admin';
  const isRestaurant = !!user?.restaurant_id;
  const isDomiciliario = user?.role === 'domiciliario';
  const isOwner = user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'proveedor_admin';
  const canTrack = user?.role === 'admin' || user?.role === 'gerente' || isSupplier || isDomiciliario;

  const brandName = tenant && tenant.name && tenant.type !== 'platform'
    ? `${tenant.name} · Zupply`
    : 'Zupply';

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition duration-150 ${
      isActive(path)
        ? 'bg-white text-brand shadow-sm font-bold'
        : 'text-white/90 hover:bg-white/15 hover:text-white'
    }`;

  const mobileLinkClass = (path: string) =>
    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
      isActive(path)
        ? 'bg-brand text-white font-bold shadow-sm'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <>
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between gap-2">
          
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center shadow-sm font-black text-brand text-lg group-hover:scale-105 transition">
                Z
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight leading-none text-white drop-shadow-sm">
                  {brandName}
                </span>
                <span className="text-[10px] text-sky-100 font-medium tracking-wide">
                  {isSupplier ? 'Portal Proveedor' : isDomiciliario ? 'App Domiciliario' : 'Plataforma B2B'}
                </span>
              </div>
            </Link>
          </div>

          {/* Menú Segmentado de Pestañas (Desktop) - SIN EMOJIS, CON ICONOS SVG LIMPIOS */}
          <nav className="hidden lg:flex items-center gap-1 bg-black/20 p-1 rounded-2xl border border-white/15 backdrop-blur-md overflow-x-auto no-scrollbar shrink min-w-0 max-w-full">
            {/* Sección: Operaciones */}
            <Link to="/" className={linkClass('/')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Inicio</span>
            </Link>

            {!isDomiciliario && (
              <Link to="/catalogo" className={linkClass('/catalogo')}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Catálogo</span>
              </Link>
            )}

            {/* Botón de Carrito Desplegable Tipo Side Dashboard */}
            {!isSupplier && !isDomiciliario && (
              <button
                type="button"
                onClick={openCart}
                className="flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-[11px] xl:text-xs font-semibold rounded-xl transition duration-150 text-white/90 hover:bg-white/15 hover:text-white shrink-0 whitespace-nowrap"
                title="Abrir Carrito Desplegable"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>Carrito</span>
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white shadow-xs">
                    {count}
                  </span>
                )}
              </button>
            )}

            <Link to="/pedidos" className={linkClass('/pedidos')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Pedidos</span>
            </Link>

            {canTrack && (
              <Link to="/logistica" className={linkClass('/logistica')}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Mapa GPS</span>
            </Link>
            )}

            {/* Separador sutil */}
            <div className="h-4 w-px bg-white/20 mx-1 shrink-0" />

            {/* Sección: Gestión */}
            {isOwner && (
              <Link to="/equipo" className={linkClass('/equipo')}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Equipo</span>
              </Link>
            )}

            <Link to="/proveedores" className={linkClass('/proveedores')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Proveedores</span>
            </Link>

            {isRestaurant && (
              <Link to="/inventario" className={linkClass('/inventario')}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Inventario</span>
              </Link>
            )}

            {(user?.role === 'admin' || user?.role === 'gerente') && (
              <>
                <Link to="/facturacion" className={linkClass('/facturacion')}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Facturas</span>
                </Link>
                <Link to="/contabilidad" className={linkClass('/contabilidad')}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Contable</span>
                </Link>
              </>
            )}

            {/* Separador sutil */}
            <div className="h-4 w-px bg-white/20 mx-1 shrink-0" />

            {/* Sección: Inteligencia y Planes */}
            <Link to="/zupply-ia" className={linkClass('/zupply-ia')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>IA</span>
            </Link>
            <Link to="/planes" className={linkClass('/planes')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Planes</span>
            </Link>
          </nav>

          {/* Perfil & Acciones de Usuario */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 bg-black/20 px-2.5 py-1 rounded-xl border border-white/15">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-right">
                <p className="text-xs font-bold leading-tight truncate max-w-[110px] text-white">{user?.name || user?.username}</p>
                <p className="text-[10px] text-sky-200 capitalize leading-tight">{user?.role?.replace('_', ' ')}</p>
              </div>
              {unread > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-xs">
                  {unread}
                </span>
              )}
            </div>

            {/* Botón Cerrar Sesión Destacado y Visible */}
            <button
              onClick={handleLogout}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition border border-rose-400/50 cursor-pointer"
              title="Cerrar sesión"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Cerrar Sesión</span>
              <span className="sm:hidden">Salir</span>
            </button>

            {/* Botón de Menú Móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Menú Desplegable Móvil Dinámico */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/15 bg-white text-slate-800 px-4 py-3 shadow-2xl animate-in slide-in-from-top duration-200 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-brand/10 text-brand font-bold flex items-center justify-center">
                  {(user?.name || user?.username || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{user?.name || user?.username}</p>
                  <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100"
              >
                Cerrar Sesión
              </button>
            </div>

            {/* Categorías en Móvil */}
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Operaciones y Envíos
                </p>
                <div className="space-y-1">
                  <Link to="/" className={mobileLinkClass('/')} onClick={() => setMobileMenuOpen(false)}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Inicio / Dashboard
                    </span>
                  </Link>

                  <Link to="/pedidos" className={mobileLinkClass('/pedidos')} onClick={() => setMobileMenuOpen(false)}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Pedidos y Despachos
                    </span>
                  </Link>

                  {canTrack && (
                    <Link to="/logistica" className={mobileLinkClass('/logistica')} onClick={() => setMobileMenuOpen(false)}>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Ruta GPS en Vivo
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">En tiempo real</span>
                    </Link>
                  )}

                  {!isDomiciliario && (
                    <Link to="/catalogo" className={mobileLinkClass('/catalogo')} onClick={() => setMobileMenuOpen(false)}>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Catálogo de Insumos
                      </span>
                    </Link>
                  )}

                  {!isSupplier && !isDomiciliario && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openCart();
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition text-slate-700 hover:bg-slate-100 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Carrito Side Dashboard
                      </span>
                      {count > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white font-bold">{count}</span>}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Gestión y Equipo
                </p>
                <div className="space-y-1" onClick={() => setMobileMenuOpen(false)}>
                  {isOwner && (
                    <Link to="/equipo" className={mobileLinkClass('/equipo')}>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Equipo y Domiciliarios
                      </span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-brand">Gestión</span>
                    </Link>
                  )}
                  <Link to="/proveedores" className={mobileLinkClass('/proveedores')}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Directorio de Proveedores
                    </span>
                  </Link>
                  {isRestaurant && (
                    <Link to="/inventario" className={mobileLinkClass('/inventario')}>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Inventario de Bodega
                      </span>
                    </Link>
                  )}
                  {(user?.role === 'admin' || user?.role === 'gerente') && (
                    <>
                      <Link to="/facturacion" className={mobileLinkClass('/facturacion')}>
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Facturación Electrónica
                        </span>
                      </Link>
                      <Link to="/contabilidad" className={mobileLinkClass('/contabilidad')}>
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Contabilidad y Flujo
                        </span>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Herramientas y Planes
                </p>
                <div className="space-y-1" onClick={() => setMobileMenuOpen(false)}>
                  <Link to="/zupply-ia" className={mobileLinkClass('/zupply-ia')}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Asistente Zupply IA
                    </span>
                  </Link>
                  <Link to="/planes" className={mobileLinkClass('/planes')}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Planes y Suscripción
                    </span>
                  </Link>
                </div>
              </div>

              {/* Botón Cerrar Sesión Móvil */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition"
                >
                  <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Barra de Navegación Inferior Móvil (Estilo App Nativa Android / DiDi) - SIN EMOJIS */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg flex items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            isActive('/') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] mt-0.5">Inicio</span>
        </Link>

        <Link
          to="/pedidos"
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            isActive('/pedidos') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[10px] mt-0.5">Pedidos</span>
        </Link>

        {canTrack && (
          <Link
            to="/logistica"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition relative ${
              isActive('/logistica') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-[10px] mt-0.5">GPS</span>
            <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </Link>
        )}

        {/* Carrito Side Drawer en móvil si no es proveedor */}
        {!isSupplier && !isDomiciliario ? (
          <button
            type="button"
            onClick={openCart}
            className="flex flex-col items-center py-1 px-2 rounded-xl transition text-slate-500 hover:text-slate-800 relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-[10px] mt-0.5">Carrito</span>
            {count > 0 && (
              <span className="absolute top-0 right-2 rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {count}
              </span>
            )}
          </button>
        ) : (
          <Link
            to="/catalogo"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive('/catalogo') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] mt-0.5">Catálogo</span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            mobileMenuOpen ? 'text-brand font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
          <span className="text-[10px] mt-0.5">Más</span>
        </button>
      </nav>
    </>
  );
}
