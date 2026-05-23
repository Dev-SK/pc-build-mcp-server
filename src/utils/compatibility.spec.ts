import {
  checkCompatibility,
  extractSocket,
  extractDdr,
  extractWattage,
  extractTdp,
  extractFormFactor,
} from './compatibility';
import { ProductDetail } from '../scraper/parsers';

// ─── Factory helper ───────────────────────────────────────────────────────────

const makeProduct = (specs: Record<string, string>): ProductDetail => ({
  name: 'Test Product',
  price: 10000,
  currency: 'INR',
  in_stock: true,
  brand: 'Test',
  category: null,
  url: 'https://mdcomputers.in/test.html',
  thumbnail_url: null,
  specs,
  description: null,
  warranty: null,
  rating: null,
  review_count: null,
});

// ─── Spec extractors ──────────────────────────────────────────────────────────

describe('extractSocket', () => {
  it('extracts socket from "Socket" key', () => {
    expect(extractSocket({ Socket: 'AM5' })).toBe('am5');
  });

  it('extracts socket from "CPU Socket" key', () => {
    expect(extractSocket({ 'CPU Socket': 'LGA1700' })).toBe('lga1700');
  });

  it('removes whitespace', () => {
    expect(extractSocket({ Socket: 'LGA 1700' })).toBe('lga1700');
  });

  it('returns null when socket key is absent', () => {
    expect(extractSocket({ Cores: '6' })).toBeNull();
  });
});

describe('extractDdr', () => {
  it('extracts DDR5 from "Memory Type"', () => {
    expect(extractDdr({ 'Memory Type': 'DDR5 6000 MHz' })).toBe('ddr5');
  });

  it('extracts DDR4 case-insensitively', () => {
    expect(extractDdr({ 'RAM Type': 'ddr4' })).toBe('ddr4');
  });

  it('returns null when no DDR info is present', () => {
    expect(extractDdr({ Cores: '6' })).toBeNull();
  });
});

describe('extractWattage', () => {
  it('extracts wattage from "Wattage"', () => {
    expect(extractWattage({ Wattage: '650W Gold' })).toBe(650);
  });

  it('extracts wattage from "Rated Power"', () => {
    expect(extractWattage({ 'Rated Power': '750 W' })).toBe(750);
  });

  it('returns null when no wattage key exists', () => {
    expect(extractWattage({ Cores: '6' })).toBeNull();
  });
});

describe('extractTdp', () => {
  it('extracts TDP from "TDP"', () => {
    expect(extractTdp({ TDP: '125 W' })).toBe(125);
  });

  it('returns null when TDP key is absent', () => {
    expect(extractTdp({ Cores: '6' })).toBeNull();
  });
});

describe('extractFormFactor', () => {
  it('normalises "ATX" to "atx"', () => {
    expect(extractFormFactor({ 'Form Factor': 'ATX' })).toBe('atx');
  });

  it('normalises "Micro ATX" to "matx"', () => {
    expect(extractFormFactor({ 'Form Factor': 'Micro ATX' })).toBe('matx');
  });

  it('normalises "Mini-ITX" to "miniitx"', () => {
    expect(extractFormFactor({ 'Form Factor': 'Mini-ITX' })).toBe('miniitx');
  });

  it('returns null when form factor key is absent', () => {
    expect(extractFormFactor({ Cores: '6' })).toBeNull();
  });
});

// ─── checkCompatibility ───────────────────────────────────────────────────────

describe('checkCompatibility', () => {
  it('passes when CPU and motherboard sockets match', () => {
    const cpu = makeProduct({ Socket: 'AM5', TDP: '65 W' });
    const mb = makeProduct({
      Socket: 'AM5',
      'Form Factor': 'ATX',
      'Memory Type': 'DDR5',
    });
    const { checks, warnings } = checkCompatibility({ cpu, motherboard: mb });
    expect(checks['cpu_motherboard'].ok).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('fails when CPU and motherboard sockets differ', () => {
    const cpu = makeProduct({ Socket: 'LGA1700' });
    const mb = makeProduct({ Socket: 'AM5' });
    const { checks, warnings } = checkCompatibility({ cpu, motherboard: mb });
    expect(checks['cpu_motherboard'].ok).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('passes when RAM and motherboard DDR generation match', () => {
    const ram = makeProduct({ 'Memory Type': 'DDR5 6000 MHz' });
    const mb = makeProduct({ 'Memory Type': 'DDR5', Socket: 'AM5' });
    const { checks } = checkCompatibility({ ram, motherboard: mb });
    expect(checks['ram_motherboard'].ok).toBe(true);
  });

  it('fails when RAM and motherboard DDR generation differ', () => {
    const ram = makeProduct({ 'Memory Type': 'DDR4 3200 MHz' });
    const mb = makeProduct({ 'Memory Type': 'DDR5' });
    const { checks, warnings } = checkCompatibility({ ram, motherboard: mb });
    expect(checks['ram_motherboard'].ok).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('passes PSU check when wattage is sufficient', () => {
    const cpu = makeProduct({ TDP: '65 W' });
    const gpu = makeProduct({ TDP: '165 W' });
    const psu = makeProduct({ Wattage: '650W' });
    const { checks } = checkCompatibility({ cpu, gpu, psu });
    // 65 + 165 + 100 = 330 W; 650 W >= 330 W
    expect(checks['psu_load'].ok).toBe(true);
  });

  it('fails PSU check when wattage is insufficient', () => {
    const cpu = makeProduct({ TDP: '125 W' });
    const gpu = makeProduct({ TDP: '300 W' });
    const psu = makeProduct({ Wattage: '400W' });
    const { checks, warnings } = checkCompatibility({ cpu, gpu, psu });
    // 125 + 300 + 100 = 525 W; 400 W < 525 W
    expect(checks['psu_load'].ok).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('passes cabinet/motherboard check when form factors are compatible', () => {
    const cabinet = makeProduct({ 'Form Factor': 'ATX' });
    const mb = makeProduct({ 'Form Factor': 'Micro ATX' });
    const { checks } = checkCompatibility({ cabinet, motherboard: mb });
    expect(checks['cabinet_motherboard'].ok).toBe(true);
  });

  it('fails cabinet/motherboard check when form factors are incompatible', () => {
    const cabinet = makeProduct({ 'Form Factor': 'Mini-ITX' });
    const mb = makeProduct({ 'Form Factor': 'ATX' });
    const { checks, warnings } = checkCompatibility({
      cabinet,
      motherboard: mb,
    });
    expect(checks['cabinet_motherboard'].ok).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('uses default TDP estimates when CPU/GPU are absent', () => {
    const psu = makeProduct({ Wattage: '300W' });
    const { checks } = checkCompatibility({ psu });
    // default: 65 + 75 + 100 = 240 W; 300 W >= 240 W
    expect(checks['psu_load'].ok).toBe(true);
  });

  it('returns no checks when no components are provided', () => {
    const { checks, warnings } = checkCompatibility({});
    expect(Object.keys(checks)).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
