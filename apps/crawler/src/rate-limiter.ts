export class OriginRateLimiter {
  readonly #tails = new Map<string, Promise<void>>();
  readonly #nextAllowedAt = new Map<string, number>();
  readonly #now: () => number;
  readonly #wait: (milliseconds: number) => Promise<void>;

  constructor(
    now: () => number = Date.now,
    wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.#now = now;
    this.#wait = wait;
  }

  async acquire(origin: string, delayMs: number): Promise<void> {
    const previous = this.#tails.get(origin) ?? Promise.resolve();
    const current = previous.then(async () => {
      const waitMs = Math.max(0, (this.#nextAllowedAt.get(origin) ?? 0) - this.#now());
      if (waitMs > 0) await this.#wait(waitMs);
      this.#nextAllowedAt.set(origin, this.#now() + delayMs);
    });
    this.#tails.set(
      origin,
      current.catch(() => undefined),
    );
    await current;
  }
}
