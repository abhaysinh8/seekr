import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../errors/http-error.js';

interface Window {
  count: number;
  resetAt: number;
}
export function createRateLimitHook(maximum: number, now: () => number = Date.now) {
  const windows = new Map<string, Window>();
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.url.startsWith('/v1/')) return;
    const key = request.auth?.id ?? request.ip;
    const timestamp = now();
    const existing = windows.get(key);
    const window =
      existing === undefined || existing.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + 60_000 }
        : existing;
    window.count += 1;
    windows.set(key, window);
    reply
      .header('x-ratelimit-limit', maximum)
      .header('x-ratelimit-remaining', Math.max(0, maximum - window.count))
      .header('x-ratelimit-reset', Math.ceil(window.resetAt / 1000));
    if (window.count > maximum) {
      reply.header('retry-after', Math.max(1, Math.ceil((window.resetAt - timestamp) / 1000)));
      throw new HttpError(429, 'RATE_LIMITED', 'Request rate limit exceeded');
    }
    if (windows.size > 10_000)
      for (const [id, entry] of windows) if (entry.resetAt <= timestamp) windows.delete(id);
  };
}
