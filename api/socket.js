/**
 * Socket.io singleton for realtime dashboard updates
 */
let io = null;

export function setIO(instance) {
  io = instance;
}

export function getIO() {
  return io;
}

/**
 * Broadcast dashboard refresh signal to all connected clients.
 */
export function emitDashboardRefresh(event = 'dashboard:refresh', payload = {}) {
  if (!io) return;
  const data = {
    at: new Date().toISOString(),
    ...payload
  };
  io.emit(event, data);
  if (event !== 'dashboard:refresh') {
    io.emit('dashboard:refresh', data);
  }
}
