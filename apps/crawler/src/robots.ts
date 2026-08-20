const SEEKR_USER_AGENT = 'SeekrBot';

interface RobotsRule {
  readonly allow: boolean;
  readonly path: string;
}

interface RobotsGroup {
  readonly agents: string[];
  readonly rules: RobotsRule[];
  crawlDelayMs?: number;
}

export class RobotsPolicy {
  readonly #groups: readonly RobotsGroup[];

  constructor(text: string) {
    this.#groups = parseRobots(text);
  }

  isAllowed(urlValue: string, userAgent = SEEKR_USER_AGENT): boolean {
    const path = `${new URL(urlValue).pathname}${new URL(urlValue).search}`;
    const rules = selectGroups(this.#groups, userAgent).flatMap((group) => group.rules);
    const matches = rules.filter((rule) => path.startsWith(rule.path));
    if (matches.length === 0) return true;
    matches.sort(
      (left, right) =>
        right.path.length - left.path.length || Number(right.allow) - Number(left.allow),
    );
    return matches[0]?.allow ?? true;
  }

  crawlDelayMs(userAgent = SEEKR_USER_AGENT): number | undefined {
    return selectGroups(this.#groups, userAgent)
      .map((group) => group.crawlDelayMs)
      .find((value): value is number => value !== undefined);
  }
}

function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  let hasDirectives = false;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*$/u, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      if (current === undefined || hasDirectives) {
        current = { agents: [], rules: [] };
        groups.push(current);
        hasDirectives = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (current === undefined) continue;
    if (directive === 'allow' || directive === 'disallow') {
      hasDirectives = true;
      if (value.length > 0) current.rules.push({ allow: directive === 'allow', path: value });
    } else if (directive === 'crawl-delay') {
      hasDirectives = true;
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelayMs = seconds * 1000;
    }
  }
  return groups;
}

function selectGroups(groups: readonly RobotsGroup[], userAgent: string): RobotsGroup[] {
  const normalized = userAgent.toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== '*' && normalized.includes(agent)),
  );
  return specific.length > 0 ? specific : groups.filter((group) => group.agents.includes('*'));
}

export interface RobotsTextLoader {
  load(url: string, signal?: AbortSignal): Promise<string>;
}

export class RobotsTxtCache {
  readonly #loader: RobotsTextLoader;
  readonly #cache = new Map<string, Promise<RobotsPolicy>>();

  constructor(loader: RobotsTextLoader = new DefaultRobotsTextLoader()) {
    this.#loader = loader;
  }

  getPolicy(urlValue: string, signal?: AbortSignal): Promise<RobotsPolicy> {
    const url = new URL(urlValue);
    const origin = url.origin;
    const existing = this.#cache.get(origin);
    if (existing !== undefined) return existing;
    const policy = this.#loader
      .load(`${origin}/robots.txt`, signal)
      .then((text) => new RobotsPolicy(text))
      .catch(() => new RobotsPolicy(''));
    this.#cache.set(origin, policy);
    return policy;
  }
}

class DefaultRobotsTextLoader implements RobotsTextLoader {
  async load(url: string, signal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(5_000);
    const combinedSignal = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    const response = await fetch(url, {
      headers: { 'user-agent': 'SeekrBot/0.1 (+https://github.com/seekr)' },
      redirect: 'error',
      signal: combinedSignal,
    });
    if (!response.ok) return '';
    const length = Number(response.headers.get('content-length') ?? '0');
    if (length > 64 * 1024) return '';
    return (await response.text()).slice(0, 64 * 1024);
  }
}
