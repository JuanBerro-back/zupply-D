import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const PLANS = [
  {
    id: 'basico',
    name: 'Plan Básico',
    price: 'Gratis',
    features: [
      'Funcionalidades esenciales',
      'Catálogo y pedidos B2B',
      'Zupply IA básica',
      'Soporte por correo',
    ],
    highlight: false,
  },
  {
    id: 'medio',
    name: 'Plan Medio',
    price: '$250.000/mes',
    features: [
      'Todo lo del Plan Básico',
      'Gestión avanzada de inventario',
      'Análisis y reportes',
      'Alertas de stock',
      'Logística y entregas',
    ],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Plan Premium',
    price: '$500.000/mes',
    features: [
      'Todo lo del Plan Medio',
      'Predicción de inventario con IA',
      'Reportes automatizados',
      'Asistente inteligente avanzado',
      'Prioridad en soporte',
    ],
    highlight: false,
  },
];

export default function Plans() {
  const { user } = useAuth();
  const { push } = useNotifications();

  const select = (id: string) => {
    push({ message: `Plan ${id} seleccionado (simulación)`, at: new Date().toISOString() });
  };

  return (
    <div>
      <h2 className="mb-2 text-xl font-bold">Planes de servicio</h2>
      <p className="mb-6 text-sm text-gray-500">
        Modelo de ingresos híbrido de Zupply: tarifa periódica de mantenimiento y soporte. Elige el plan que mejor
        se adapte a tu operación.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col rounded-lg border bg-white p-6 shadow-sm ${
              p.highlight ? 'border-2 border-brand' : ''
            }`}
          >
            <h3 className="text-lg font-bold">{p.name}</h3>
            <p className="mb-4 text-2xl font-extrabold text-brand">{p.price}</p>
            <ul className="mb-6 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => select(p.id)}
              className={`rounded py-2 font-medium ${
                p.highlight
                  ? 'bg-brand text-white hover:bg-brand-dark'
                  : 'border border-brand text-brand hover:bg-brand hover:text-white'
              }`}
            >
              {user ? 'Seleccionar plan' : 'Inicia sesión'}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Tus pedidos de este mes: <b>1</b> · Plan actual: <b>Básico</b> (demo)
      </p>
    </div>
  );
}