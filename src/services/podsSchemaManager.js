const fs = require('fs');
const path = require('path');
const db = require('./database');
const logger = require('../utils/logger');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  '..',
  'database',
  'migrations',
  '009_create_pods_tables.sql'
);

let schemaEnsured = false;

const getMissingTables = async () => {
  const result = await db.query(
    `
      SELECT 
        to_regclass('public.pods') AS pods,
        to_regclass('public.pod_images') AS pod_images,
        to_regclass('public.user_preferences') AS user_preferences
    `
  );

  const row = result.rows[0] || {};
  const missing = [];

  if (!row.pods) missing.push('pods');
  if (!row.pod_images) missing.push('pod_images');
  if (!row.user_preferences) missing.push('user_preferences');

  return missing;
};

const ensurePodsSchema = async () => {
  if (schemaEnsured) {
    return true;
  }

  try {
    const missing = await getMissingTables();
    if (missing.length === 0) {
      schemaEnsured = true;
      logger.debug('Pods schema already present');
      return true;
    }

    if (!fs.existsSync(MIGRATION_FILE)) {
      const error = new Error(`Pods migration file not found at ${MIGRATION_FILE}`);
      logger.error('Pods schema manager could not locate migration file', {
        error: error.message,
      });
      throw error;
    }

    logger.warn('Pods schema incomplete. Running migration to create missing tables.', {
      missing,
    });

    const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await db.query(migrationSql);

    schemaEnsured = true;
    logger.info('Pods schema ensured successfully');
    return true;
  } catch (error) {
    logger.error('Failed to ensure pods schema', { error: error.message });
    throw error;
  }
};

module.exports = {
  ensurePodsSchema,
};
