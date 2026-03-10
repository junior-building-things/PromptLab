import crypto from 'node:crypto';
import { Pool } from 'pg';

const globalForDb = globalThis;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL. Configure a Postgres database for PromptLab persistence.');
  }

  const useSsl = !/localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

function getPool() {
  if (!globalForDb.__promptlabPool) {
    globalForDb.__promptlabPool = createPool();
  }

  return globalForDb.__promptlabPool;
}

let schemaPromise;

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('Missing ENCRYPTION_SECRET or SESSION_SECRET.');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function decryptValue(payload) {
  if (!payload) {
    return null;
  }

  const buffer = Buffer.from(payload, 'base64url');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function ensureSchema() {
  if (!schemaPromise) {
    const pool = getPool();
    schemaPromise = pool.query(`
      create table if not exists promptlab_users (
        user_id text primary key,
        email text,
        name text,
        avatar_url text,
        state_json jsonb,
        provider_keys jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
  }

  await schemaPromise;
}

async function ensureUserRecord(user) {
  await ensureSchema();
  const pool = getPool();
  await pool.query(
    `
      insert into promptlab_users (user_id, email, name, avatar_url)
      values ($1, $2, $3, $4)
      on conflict (user_id)
      do update set
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = now()
    `,
    [user.id, user.email || null, user.name || null, user.avatarUrl || null],
  );
}

function toProviderStatuses(providerKeys) {
  return {
    openai: {
      hasKey: Boolean(providerKeys?.openai?.encrypted),
      updatedAt: providerKeys?.openai?.updatedAt || null,
    },
    gemini: {
      hasKey: Boolean(providerKeys?.gemini?.encrypted),
      updatedAt: providerKeys?.gemini?.updatedAt || null,
    },
    xai: {
      hasKey: Boolean(providerKeys?.xai?.encrypted),
      updatedAt: providerKeys?.xai?.updatedAt || null,
    },
  };
}

export async function getUserWorkspace(user) {
  await ensureUserRecord(user);
  const pool = getPool();
  const result = await pool.query(
    'select state_json, provider_keys from promptlab_users where user_id = $1 limit 1',
    [user.id],
  );
  const row = result.rows[0];

  return {
    state: row?.state_json || null,
    providerKeys: toProviderStatuses(row?.provider_keys || {}),
  };
}

export async function saveUserWorkspace(user, state) {
  await ensureUserRecord(user);
  const pool = getPool();
  await pool.query(
    `
      update promptlab_users
      set state_json = $2::jsonb,
          updated_at = now()
      where user_id = $1
    `,
    [user.id, JSON.stringify(state)],
  );
}

export async function saveProviderKey(user, provider, apiKey) {
  await ensureUserRecord(user);
  const workspace = await getUserWorkspace(user);
  const pool = getPool();
  const currentResult = await pool.query(
    'select provider_keys from promptlab_users where user_id = $1 limit 1',
    [user.id],
  );
  const providerKeys = currentResult.rows[0]?.provider_keys || {};

  if (apiKey) {
    providerKeys[provider] = {
      encrypted: encryptValue(apiKey),
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete providerKeys[provider];
  }

  await pool.query(
    `
      update promptlab_users
      set provider_keys = $2::jsonb,
          updated_at = now()
      where user_id = $1
    `,
    [user.id, JSON.stringify(providerKeys)],
  );

  return {
    ...workspace,
    providerKeys: toProviderStatuses(providerKeys),
  };
}

export async function getProviderApiKey(user, provider) {
  await ensureUserRecord(user);
  const pool = getPool();
  const result = await pool.query(
    'select provider_keys from promptlab_users where user_id = $1 limit 1',
    [user.id],
  );
  const encrypted = result.rows[0]?.provider_keys?.[provider]?.encrypted;
  if (!encrypted) {
    return null;
  }

  return decryptValue(encrypted);
}
