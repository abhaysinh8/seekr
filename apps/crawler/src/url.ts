import { isIP } from 'node:net';

const PRIVATE_IPV4 = [
  /^10\./u,
  /^127\./u,
  /^169\.254\./u,
  /^192\.168\./u,
  /^172\.(?:1[6-9]|2\d|3[01])\./u,
  /^0\./u,
];

export function normalizeUrl(value: string, baseUrl?: string): string | undefined {
  try {
    const url = baseUrl === undefined ? new URL(value) : new URL(value, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    url.username = '';
    url.password = '';
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    ) {
      url.port = '';
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isAllowedDomain(urlValue: string, allowedDomains: ReadonlySet<string>): boolean {
  const hostname = new URL(urlValue).hostname.toLowerCase();
  for (const domainValue of allowedDomains) {
    const domain = domainValue.toLowerCase().replace(/^\./u, '');
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return true;
  }
  return false;
}

export function isPrivateNetworkUrl(urlValue: string): boolean {
  const hostname = new URL(urlValue).hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return PRIVATE_IPV4.some((pattern) => pattern.test(hostname));
  if (ipVersion === 6) {
    return (
      hostname === '::1' ||
      hostname === '::' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe8')
    );
  }
  return false;
}
