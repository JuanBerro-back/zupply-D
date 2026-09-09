import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';

export default function Navbar() {
  const { user, tenant, logout } = useAuth();
  const { count } = useCart();
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

          {/* Menú Segmentado de Pestañas (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-black/15 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
            {/* Sección: Operaciones */}
            <Link to="/" className={linkClass('/')}>
              <span>🏠</span> Inicio
            </Link>
            {!isDomiciliario && (
              <Link to="/catalogo" className={linkClass('/catalogo')}>
                <span>🛍️</span> Catálogo
              </Link>
            )}
            {!isSupplier && !isDomiciliario && (
              <Link to="/carrito" className={linkClass('/carrito')}>
                <span>🛒</span> Carrito
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                    {count}
                  </span>
                )}
              </Link>
            )}
            <Link to="/pedidos" className={linkClass('/pedidos')}>
              <span>📦</span> Pedidos
            </Link>
            {canTrack && (
              <Link to="/logistica" className={linkClass('/logistica')}>
                <span>🗺️</span> Mapa GPS
              </Link>
            )}

            {/* Separador sutil */}
            <div className="h-4 w-px bg-white/20 mx-1" />

            {/* Sección: Gestión */}
            {isOwner && (
              <Link to="/equipo" className={linkClass('/equipo')}>
                <span>👥</span> Equipo
              </Link>
            )}
            <Link to="/proveedores" className={linkClass('/proveedores')}>
              <span>🏢</span> Proveedores
            </Link>
            {isRestaurant && (
              <Link to="/inventario" className={linkClass('/inventario')}>
                <span>📊</span> Inventario
              </Link>
            )}
            {(user?.role === 'admin' || user?.role === 'gerente') && (
              <>
                <Link to="/facturacion" className={linkClass('/facturacion')}>
                  <span>🧾</span> Facturas
                </Link>
                <Link to="/contabilidad" className={linkClass('/contabilidad')}>
                  <span>📈</span> Contable
                </Link>
              </>
            )}

            {/* Separador sutil */}
            <div className="h-4 w-px bg-white/20 mx-1" />

            {/* Sección: Inteligencia y Planes */}
            <Link to="/zupply-ia" className={linkClass('/zupply-ia')}>
              <span>🤖</span> IA
            </Link>
            <Link to="/planes" className={linkClass('/planes')}>
              <span>💎</span> Planes
            </Link>
          </nav>

          {/* Perfil & Acciones de Usuario */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-black/10 px-2.5 py-1 rounded-xl border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-right">
                <p className="text-xs font-bold leading-tight truncate max-w-[120px]">{user?.name || user?.username}</p>
                <p className="text-[10px] text-sky-200 capitalize leading-tight">{user?.role?.replace('_', ' ')}</p>
              </div>
              {unread > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {unread}
                </span>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25 active:scale-95 transition"
              title="Cerrar sesión"
            >
              Salir
            </button>

            {/* Botón de Menú Móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? '✕' : '☰'}
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
                <div className="space-y-1" onClick={() => setMobileMenuOpen(false)}>
                  <Link to="/" className={mobileLinkClass('/')}>
                    <span className="flex items-center gap-2">🏠 Inicio / Dashboard</span>
                  </Link>
                  <Link to="/pedidos" className={mobileLinkClass('/pedidos')}>
                    <span className="flex items-center gap-2">📦 Pedidos y Despachos</span>
                  </Link>
                  {canTrack && (
                    <Link to="/logistica" className={mobileLinkClass('/logistica')}>
                      <span className="flex items-center gap-2">🗺️ Ruta GPS en Vivo</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">En tiempo real</span>
                    </Link>
                  )}
                  {!isDomiciliario && (
                    <Link to="/catalogo" className={mobileLinkClass('/catalogo')}>
                      <span className="flex items-center gap-2">🛍️ Catálogo de Insumos</span>
                    </Link>
                  )}
                  {!isSupplier && !isDomiciliario && (
                    <Link to="/carrito" className={mobileLinkClass('/carrito')}>
                      <span className="flex items-center gap-2">🛒 Carrito de Compras</span>
                      {count > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white font-bold">{count}</span>}
                    </Link>
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
                      <span className="flex items-center gap-2">👥 Equipo y Domiciliarios</span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-brand">Gestión</span>
                    </Link>
                  )}
                  <Link to="/proveedores" className={mobileLinkClass('/proveedores')}>
                    <span className="flex items-center gap-2">🏢 Directorio de Proveedores</span>
                  </Link>
                  {isRestaurant && (
                    <Link to="/inventario" className={mobileLinkClass('/inventario')}>
                      <span className="flex items-center gap-2">📊 Inventario de Bodega</span>
                    </Link>
                  )}
                  {(user?.role === 'admin' || user?.role === 'gerente') && (
                    <>
                      <Link to="/facturacion" className={mobileLinkClass('/facturacion')}>
                        <span className="flex items-center gap-2">🧾 Facturación Electrónica</span>
                      </Link>
                      <Link to="/contabilidad" className={mobileLinkClass('/contabilidad')}>
                        <span className="flex items-center gap-2">📈 Contabilidad y Flujo</span>
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
                    <span className="flex items-center gap-2">🤖 Asistente Zupply IA</span>
                  </Link>
                  <Link to="/planes" className={mobileLinkClass('/planes')}>
                    <span className="flex items-center gap-2">💎 Planes y Suscripción</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Barra de Navegación Inferior Móvil (Estilo App Nativa Android / DiDi) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg flex items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            isActive('/') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-lg leading-none">🏠</span>
          <span className="text-[10px] mt-1">Inicio</span>
        </Link>

        <Link
          to="/pedidos"
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            isActive('/pedidos') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-lg leading-none">📦</span>
          <span className="text-[10px] mt-1">Pedidos</span>
        </Link>

        {canTrack && (
          <Link
            to="/logistica"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition relative ${
              isActive('/logistica') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-lg leading-none">🗺️</span>
            <span className="text-[10px] mt-1">GPS</span>
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </Link>
        )}

        {isOwner ? (
          <Link
            to="/equipo"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive('/equipo') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-lg leading-none">👥</span>
            <span className="text-[10px] mt-1">Equipo</span>
          </Link>
        ) : (
          <Link
            to="/catalogo"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive('/catalogo') ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-lg leading-none">🛍️</span>
            <span className="text-[10px] mt-1">Catálogo</span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            mobileMenuOpen ? 'text-brand font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-lg leading-none">{mobileMenuOpen ? '✕' : '☰'}</span>
          <span className="text-[10px] mt-1">Más</span>
        </button>
      </nav>
    </>
  );
}
