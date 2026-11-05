import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function ensureDatabaseExists() {
  const targetDb = process.env.DB_NAME || 'recipe_db';
  const adminClient = new pg.Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb]
    );
    if (res.rowCount === 0) {
      const initSqlPath = path.join(migrationsDir, '000_create_database.sql');
      if (fs.existsSync(initSqlPath)) {
        const rawSql = fs.readFileSync(initSqlPath, 'utf8');
        const sql = rawSql.replace(/recipe_db/g, targetDb.replace(/"/g, '""'));
        await adminClient.query(sql);
      } else {
        await adminClient.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
      }
      console.log(`Created database: ${targetDb}`);
    }
  } catch (err) {
    // If checking default 'postgres' fails, continue and let main client connect
  } finally {
    try {
      await adminClient.end();
    } catch (_) {}
  }
}

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const result = await client.query('SELECT name FROM schema_migrations ORDER BY name');
  return new Set(result.rows.map((row) => row.name));
}

async function runMigration(name, sql) {
  await client.query(sql);
  await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
  console.log('Applied:', name);
}

async function migrate() {
  await ensureDatabaseExists();
  await client.connect();
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== '000_create_database.sql')
    .sort();

  for (const file of files) {
    const name = path.basename(file, '.sql');
    if (applied.has(name)) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    await runMigration(name, sql);
  }

  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
