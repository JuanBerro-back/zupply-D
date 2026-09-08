import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';

export default function Navbar() {
  const { user, tenant, logout } = useAuth();
  const { count } = useCart();
  const { unread } = useNotifications();
  const navigate = useNavigate();

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
    ? `${tenant.name} - Zupply`
    : 'Zupply';

  return (
    <nav className="sticky top-0 z-20 bg-brand text-white shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/" className="text-xl font-bold">{brandName}</Link>
          {!isDomiciliario && <Link to="/catalogo" className="text-sm hover:underline">Catálogo</Link>}
          {!isSupplier && !isDomiciliario && <Link to="/carrito" className="text-sm hover:underline">Carrito ({count})</Link>}
          <Link to="/pedidos" className="text-sm hover:underline">Pedidos</Link>
          {isRestaurant && (
            <>
              <Link to="/inventario" className="text-sm hover:underline">Inventario</Link>
              {(user?.role === 'admin' || user?.role === 'gerente') && (
                <>
                  <Link to="/facturacion" className="text-sm hover:underline">Facturación</Link>
                  <Link to="/contabilidad" className="text-sm hover:underline">Contabilidad</Link>
                </>
              )}
            </>
          )}
          {canTrack && <Link to="/logistica" className="text-sm hover:underline">Mapa GPS</Link>}
          <Link to="/proveedores" className="text-sm hover:underline">Proveedores</Link>
          {isOwner && <Link to="/equipo" className="text-sm hover:underline">Equipo</Link>}
          <Link to="/planes" className="text-sm hover:underline">Planes</Link>
          <Link to="/zupply-ia" className="text-sm hover:underline">Zupply IA</Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative">
            <span className="text-sm opacity-90">{user?.username}</span>
            <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">{unread}</span>
          </span>
          <button onClick={handleLogout} className="rounded bg-white/20 px-3 py-1 text-sm hover:bg-white/30">
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
