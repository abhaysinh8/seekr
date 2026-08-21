import { isIP } from 'node:net';

const PRIVATE_IPV4 = [
  /^10\./u,
  /^127\./u,
  /^169\.254\./u,
  /^192\.168\./u,
  /^172\.(?:1[6-9]|2\d|3[01])\./u,
  /^0\./u,
  /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u,
  /^198\.(?:1[89])\./u,
  /^192\.0\.0\./u,
  /^192\.0\.2\./u,
  /^198\.51\.100\./u,
  /^203\.0\.113\./u,
  /^(?:22[4-9]|23\d)\./u,
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
  return isPrivateNetworkAddress(hostname);
}

export function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/gu, '');
  const ipVersion = isIP(normalized);
  if (ipVersion === 4)
    return (
      PRIVATE_IPV4.some((pattern) => pattern.test(normalized)) || normalized === '255.255.255.255'
    );
  if (ipVersion === 6)
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/u.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  return false;
}
