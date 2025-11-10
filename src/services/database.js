const { Pool } = require('pg');
const logger = require('../utils/logger');

// Create PostgreSQL connection pool
// Prefer DATABASE_URL (Render's format) over individual params (local dev)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
        statement_timeout: 30000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'designer_bff',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
        statement_timeout: 30000,
      }
);

// Pool error handler
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', { error: err.message });
});

// Pool connect handler
pool.on('connect', (client) => {
  logger.debug('New client connected to database');
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    logger.error('Database query error', {
      query: text.substring(0, 100),
      error: error.message,
      params: params ? params.length : 0
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout to release
  const timeout = setTimeout(() => {
    logger.error('A client has been checked out for more than 30 seconds!');
  }, 30000);
  
  // Monkey patch the query method to track queries
  client.query = (...args) => {
    client.lastQuery = args;
    return query(...args);
  };
  
  // Override release to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback function
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    console.log('==> Attempting database connection...');
    console.log('==> Using DATABASE_URL:', !!process.env.DATABASE_URL);
    const result = await query('SELECT NOW() as time, version() as version');
    console.log('==> Database query successful!');
    logger.info('Database connection successful', {
      time: result.rows[0].time,
      version: result.rows[0].version.split(',')[0]
    });
    return true;
  } catch (error) {
    console.error('==> Database connection error:', error.message);
    console.error('==> Error details:', error);
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
};

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool', { error: error.message });
  }
};

/**
 * Get pool statistics
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
};

module.exports = {
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  getPoolStats,
  pool
};
