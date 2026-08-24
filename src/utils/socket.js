import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket = null;

/**
 * Shared Socket.io client (connects to same origin via Vite proxy in dev).
 */
export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected', reason);
  });

  return socket;
}

export function joinOutletRoom(outletId) {
  const s = getSocket();
  if (outletId) s.emit('join:outlet', String(outletId));
}
