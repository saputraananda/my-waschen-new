import express from 'express';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import app from './api/index.js';
import { setIO } from './api/socket.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 7001;

// Serve static assets in production (Hostinger / Standalone Server)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Wildcard handler for client side routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('My Waschen API Server is running. Frontend dev server is active on port 7000.');
  });
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  },
  path: '/socket.io'
});

setIO(io);

io.on('connection', (socket) => {
  socket.on('join:outlet', (outletId) => {
    if (!outletId) return;
    socket.join(`outlet:${outletId}`);
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  My Waschen Server Status: Running     `);
  console.log(`  Port: http://localhost:${PORT}        `);
  console.log(`  Socket.io: enabled                   `);
  console.log(`=========================================`);
});
