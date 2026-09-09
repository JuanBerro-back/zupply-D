import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;
const SOCKET_ORIGIN = import.meta.env.VITE_API_URL || undefined;

export function connectSocket(opts: {
  userId?: number | null;
  restaurantId?: number | null;
  supplierId?: number | null;
}): Socket {
  if (socket) return socket;
  socket = io(SOCKET_ORIGIN, {
    auth: { token: getToken() },
    query: {
      ...(opts.userId ? { userId: String(opts.userId) } : {}),
      ...(opts.restaurantId ? { restaurantId: String(opts.restaurantId) } : {}),
      ...(opts.supplierId ? { supplierId: String(opts.supplierId) } : {}),
    },
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}