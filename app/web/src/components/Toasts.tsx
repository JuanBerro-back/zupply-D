import { useNotifications } from '../context/NotificationContext';

export default function Toasts() {
  const { items, dismiss, clear } = useNotifications();
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      {items.map((n, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">{n.message}</p>
            <button onClick={() => dismiss(i)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
          <p className="mt-1 text-xs text-gray-400">{new Date(n.at).toLocaleTimeString()}</p>
        </div>
      ))}
      <button onClick={clear} className="w-full rounded bg-gray-800 py-1 text-xs text-white">
        Limpiar notificaciones
      </button>
    </div>
  );
}