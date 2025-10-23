/**
 * Debug Server Startup
 * This wraps the server with better error handling to see what's crashing
 */

process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running to debug
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running to debug
});

// Now load the actual server
require('./server.js');
