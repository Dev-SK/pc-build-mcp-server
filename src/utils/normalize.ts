/**
 * Collapse consecutive whitespace and trim a spec key string.
 */
export const normalizeSpecKey = (raw: string): string =>
  raw.replace(/\s+/g, ' ').trim();

/**
 * Return true when the stock string indicates an in-stock product.
 */
export const normalizeStockStatus = (raw: string): boolean =>
  /in\s*stock/i.test(raw);

/**
 * Parse an INR price string like "₹45,999.00" → 45999.
 * Returns null when no numeric value can be extracted.
 */
export const parsePriceInr = (raw: string): number | null => {
  const numeric = raw.replace(/[^\d.]/g, '').trim();
  if (!numeric) return null;
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? Math.round(value) : null;
};

/**
 * Extract the first numeric value from a string (e.g. "650W Bronze" → 650).
 */
export const extractFirstNumber = (raw: string): number | null => {
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
};

/**
 * Canonicalise a spec key to a known common name when multiple vendor-specific
 * names refer to the same spec (e.g. "Core Count" → "Cores").
 */
const SPEC_ALIASES: Record<string, string> = {
  'core count': 'Cores',
  'no. of cores': 'Cores',
  'number of cores': 'Cores',
  'thread count': 'Threads',
  'no. of threads': 'Threads',
  'number of threads': 'Threads',
  'base frequency': 'Base Clock',
  'base clock speed': 'Base Clock',
  'boost frequency': 'Boost Clock',
  'boost clock speed': 'Boost Clock',
  'memory size': 'VRAM',
  'video memory': 'VRAM',
  'graphics memory': 'VRAM',
  'power consumption': 'TDP',
  'thermal design power': 'TDP',
  'power rating': 'Wattage',
  'rated power': 'Wattage',
  'form factor': 'Form Factor',
  'motherboard form factor': 'Form Factor',
};

export const canonicalizeSpecKey = (raw: string): string => {
  const lower = normalizeSpecKey(raw).toLowerCase();
  return SPEC_ALIASES[lower] ?? normalizeSpecKey(raw);
};
