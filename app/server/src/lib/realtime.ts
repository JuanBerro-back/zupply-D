import type { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export function setIo(instance: SocketIOServer) {
  io = instance;
}

export function registerSocket(socket: Socket) {
  const { restaurantId, supplierId, orderId } = socket.handshake.query;
  if (typeof restaurantId === 'string') socket.join(`restaurant:${restaurantId}`);
  if (typeof supplierId === 'string') socket.join(`supplier:${supplierId}`);
  if (typeof orderId === 'string') socket.join(`order:${orderId}`);
}

function isOrderLike(data: unknown): data is {
  restaurant_id: number;
  supplier_id: number;
  id: number;
} {
  return (
    !!data &&
    typeof data === 'object' &&
    'restaurant_id' in data &&
    'supplier_id' in data &&
    'id' in data
  );
}

function toRestaurantId(id: number | null | undefined) {
  return `restaurant:${id}`;
}

function toSupplierId(id: number | null | undefined) {
  return `supplier:${id}`;
}

export function emitOrder(event: string, data: unknown) {
  if (!io) return;
  if (isOrderLike(data)) {
    io.to(toRestaurantId(data.restaurant_id)).emit(event, data);
    io.to(toSupplierId(data.supplier_id)).emit(event, data);
    io.to(`order:${data.id}`).emit(event, data);
  } else {
    io.emit(event, data);
  }
}

export function emitToUser(event: string, userId: number, data: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitInventoryAlert(restaurantId: number, data: unknown) {
  if (!io) return;
  io.to(toRestaurantId(restaurantId)).emit('inventory:alert', data);
}