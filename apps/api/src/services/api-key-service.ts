import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import type { ApiKeyScope, CreateApiKeyApiRequest } from '@seekr/shared';

import { HttpError } from '../errors/http-error.js';
import type { ApiKeyRecord, ApiKeyRepository } from './api-key-repository.js';

export interface AuthenticatedApiKey {
  readonly id: string;
  readonly projectId: string;
  readonly scopes: ReadonlySet<ApiKeyScope>;
}

export class ApiKeyService {
  readonly #lastUsedWrites = new Map<string, number>();
  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateApiKeyApiRequest) {
    const secret = randomBytes(32).toString('base64url');
    const prefix = randomBytes(6).toString('base64url');
    const rawKey = `skr_${prefix}_${secret}`;
    const hashedSecret = await hashSecret(secret);
    const record = await this.repository.create({
      projectId: input.projectId,
      name: input.name,
      scopes: input.scopes,
      prefix,
      hashedSecret,
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    });
    return { key: publicRecord(record), rawKey };
  }

  async authenticate(rawKey: string): Promise<AuthenticatedApiKey | undefined> {
    const parsed = parseKey(rawKey);
    if (parsed === undefined) return undefined;
    for (const candidate of await this.repository.findActiveByPrefix(parsed.prefix)) {
      if (candidate.expiresAt !== null && new Date(candidate.expiresAt) <= this.now()) continue;
      if (await verifySecret(parsed.secret, candidate.hashedSecret)) {
        this.#touchLastUsed(candidate);
        return {
          id: candidate.id,
          projectId: candidate.projectId,
          scopes: new Set(candidate.scopes),
        };
      }
    }
    return undefined;
  }

  async list(projectId: string) {
    return (await this.repository.list(projectId)).map(publicRecord);
  }
  async revoke(id: string, projectId: string) {
    const key = await this.repository.revoke(id, projectId);
    if (key === undefined) throw new HttpError(404, 'NOT_FOUND', `API key ${id} was not found`);
    return publicRecord(key);
  }
  countForProject(projectId: string) {
    return this.repository.countForProject(projectId);
  }

  #touchLastUsed(key: ApiKeyRecord): void {
    const timestamp = this.now().getTime();
    if (timestamp - (this.#lastUsedWrites.get(key.id) ?? 0) < 5 * 60_000) return;
    this.#lastUsedWrites.set(key.id, timestamp);
    void this.repository.updateLastUsed(key.id, new Date(timestamp).toISOString()).catch(() => {
      this.#lastUsedWrites.delete(key.id);
    });
  }
}

function publicRecord(record: ApiKeyRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    prefix: record.prefix,
    scopes: record.scopes,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
  };
}
function parseKey(rawKey: string): { prefix: string; secret: string } | undefined {
  const match = /^skr_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/u.exec(rawKey);
  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : { prefix: match[1], secret: match[2] };
}
async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(secret, salt);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}
async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (saltHex === undefined || hashHex === undefined) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(secret, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, 32, (error, key) => (error === null ? resolve(key) : reject(error))),
  );
}
