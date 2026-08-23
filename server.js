import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './api/index.js';

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

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  My Waschen Server Status: Running     `);
  console.log(`  Port: http://localhost:${PORT}        `);
  console.log(`=========================================`);
});
