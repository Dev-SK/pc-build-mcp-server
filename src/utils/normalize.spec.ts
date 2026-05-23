import {
  normalizeSpecKey,
  normalizeStockStatus,
  parsePriceInr,
  extractFirstNumber,
  canonicalizeSpecKey,
} from './normalize';

describe('normalizeSpecKey', () => {
  it('collapses inner whitespace and trims', () => {
    expect(normalizeSpecKey('  GPU   Chip  ')).toBe('GPU Chip');
  });

  it('returns single words unchanged', () => {
    expect(normalizeSpecKey('Socket')).toBe('Socket');
  });
});

describe('normalizeStockStatus', () => {
  it('returns true for "In Stock"', () => {
    expect(normalizeStockStatus('In Stock')).toBe(true);
  });

  it('returns true for "in stock" (case-insensitive)', () => {
    expect(normalizeStockStatus('in stock')).toBe(true);
  });

  it('returns false for "Out of Stock"', () => {
    expect(normalizeStockStatus('Out of Stock')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(normalizeStockStatus('')).toBe(false);
  });
});

describe('parsePriceInr', () => {
  it('parses "₹45,999.00" → 45999', () => {
    expect(parsePriceInr('₹45,999.00')).toBe(45999);
  });

  it('parses plain number string "12500"', () => {
    expect(parsePriceInr('12500')).toBe(12500);
  });

  it('rounds decimal prices', () => {
    expect(parsePriceInr('₹999.99')).toBe(1000);
  });

  it('returns null for "N/A"', () => {
    expect(parsePriceInr('N/A')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePriceInr('')).toBeNull();
  });
});

describe('extractFirstNumber', () => {
  it('extracts integer from "650W Bronze"', () => {
    expect(extractFirstNumber('650W Bronze')).toBe(650);
  });

  it('extracts decimal from "3.8 GHz"', () => {
    expect(extractFirstNumber('3.8 GHz')).toBeCloseTo(3.8);
  });

  it('returns null when no digits found', () => {
    expect(extractFirstNumber('No data')).toBeNull();
  });
});

describe('canonicalizeSpecKey', () => {
  it('maps "Core Count" → "Cores"', () => {
    expect(canonicalizeSpecKey('Core Count')).toBe('Cores');
  });

  it('maps "Power Consumption" → "TDP"', () => {
    expect(canonicalizeSpecKey('Power Consumption')).toBe('TDP');
  });

  it('is case-insensitive', () => {
    expect(canonicalizeSpecKey('THREAD COUNT')).toBe('Threads');
  });

  it('preserves unknown keys unchanged (after trimming)', () => {
    expect(canonicalizeSpecKey('  Cache  ')).toBe('Cache');
  });
});
