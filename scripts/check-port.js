#!/usr/bin/env node

const net = require('net');
const logger = require('../src/utils/logger');

// Use PORT environment variable or default to 3001
// If 3001 is in use, try 3002, 3003, etc.
const basePort = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const maxAttempts = 10;

const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close();
      resolve({ available: true, port });
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ available: false, port });
      } else {
        reject(err);
      }
    });
  });
};

const findAvailablePort = async (basePort) => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    const result = await checkPort(port);
    if (result.available) {
      return port;
    }
  }
  throw new Error(`Unable to find available port after ${maxAttempts} attempts`);
};

const main = async () => {
  try {
    const port = await findAvailablePort(basePort);
    console.log(`PORT=${port}`);
    process.exit(0);
  } catch (error) {
    logger.error('Error finding available port:', { error: error.message });
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { checkPort, findAvailablePort };