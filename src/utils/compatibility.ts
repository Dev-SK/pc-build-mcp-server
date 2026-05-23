import { ProductDetail } from '../scraper/parsers';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CompatibilityCheck = {
  ok: boolean;
  note: string;
};

export type CompatibilityResult = {
  checks: Record<string, CompatibilityCheck>;
  warnings: string[];
};

// ─── Spec extractors ──────────────────────────────────────────────────────────

/**
 * Extract a socket value (lowercase, spaces removed) from a product's specs.
 */
export const extractSocket = (specs: Record<string, string>): string | null => {
  const raw =
    specs['Socket'] ?? specs['CPU Socket'] ?? specs['Processor Socket'] ?? null;
  return raw ? raw.toLowerCase().replace(/[\s]/g, '') : null;
};

/**
 * Extract the DDR generation ("ddr4" or "ddr5") from a product's specs.
 */
export const extractDdr = (specs: Record<string, string>): string | null => {
  const candidates = [
    specs['Memory Type'],
    specs['RAM Type'],
    specs['Supported Memory'],
    specs['Memory Standard'],
    specs['DDR'],
  ];
  for (const val of candidates) {
    if (!val) continue;
    const m = val.match(/ddr\s*[45]/i);
    if (m) return m[0].toLowerCase().replace(/\s/g, '');
  }
  return null;
};

/**
 * Extract rated wattage (integer) from a PSU's specs.
 */
export const extractWattage = (
  specs: Record<string, string>,
): number | null => {
  const candidates = [
    specs['Wattage'],
    specs['Power Output'],
    specs['Max Output'],
    specs['Rated Power'],
    specs['Continuous Power'],
  ];
  for (const val of candidates) {
    if (!val) continue;
    const m = val.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
};

/**
 * Extract TDP (integer watts) from a processor or GPU's specs.
 */
export const extractTdp = (specs: Record<string, string>): number | null => {
  const val = specs['TDP'] ?? specs['Thermal Design Power'] ?? null;
  if (!val) return null;
  const m = val.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

/**
 * Extract a normalised form-factor tag from a motherboard or cabinet's specs.
 * Returns lowercase, spaces removed (e.g. "atx", "matx", "miniitx").
 */
export const extractFormFactor = (
  specs: Record<string, string>,
): string | null => {
  const raw =
    specs['Form Factor'] ??
    specs['Motherboard Support'] ??
    specs['ATX Support'] ??
    null;
  if (!raw) return null;
  const normalised = raw.toLowerCase().replace(/[\s-]/g, '');
  // Normalise common variants
  if (/microatx|m-atx|matx/.test(normalised)) return 'matx';
  if (/miniitx|m-itx|mitx/.test(normalised)) return 'miniitx';
  if (/eatx|extendedatx/.test(normalised)) return 'eatx';
  if (/atx/.test(normalised)) return 'atx';
  if (/itx/.test(normalised)) return 'miniitx';
  return normalised;
};

// ─── Hierarchy for form-factor compatibility ──────────────────────────────────

/**
 * A cabinet of a given size supports these smaller (or equal) motherboard sizes.
 */
const CABINET_SUPPORTS: Record<string, string[]> = {
  eatx: ['eatx', 'atx', 'matx', 'miniitx'],
  atx: ['atx', 'matx', 'miniitx'],
  matx: ['matx', 'miniitx'],
  miniitx: ['miniitx'],
};

// ─── Main compatibility checker ───────────────────────────────────────────────

/**
 * Given a map of role → ProductDetail (roles: cpu, motherboard, ram, gpu, psu,
 * cabinet/case), return per-pair compatibility checks and a warning list.
 *
 * Rules encoded:
 *  1. CPU socket must match motherboard socket.
 *  2. RAM DDR generation must match motherboard DDR support.
 *  3. PSU wattage ≥ CPU TDP + GPU TDP + 100 W overhead.
 *  4. Cabinet must support the motherboard's form factor.
 */
export const checkCompatibility = (
  details: Record<string, ProductDetail>,
): CompatibilityResult => {
  const checks: Record<string, CompatibilityCheck> = {};
  const warnings: string[] = [];

  const cpu = details['cpu'];
  const mb = details['motherboard'];
  const ram = details['ram'];
  const gpu = details['gpu'];
  const psu = details['psu'];
  const cabinet = details['cabinet'] ?? details['case'];

  // ── 1. CPU ↔ Motherboard socket ──
  if (cpu && mb) {
    const cpuSocket = extractSocket(cpu.specs);
    const mbSocket = extractSocket(mb.specs);

    if (cpuSocket && mbSocket) {
      const ok = cpuSocket === mbSocket;
      checks['cpu_motherboard'] = {
        ok,
        note: ok
          ? `Socket match: ${cpuSocket.toUpperCase()}`
          : `Socket mismatch: CPU uses ${cpuSocket.toUpperCase()}, motherboard has ${mbSocket.toUpperCase()}`,
      };
      if (!ok) {
        warnings.push(
          `CPU socket (${cpuSocket.toUpperCase()}) does not match motherboard socket (${mbSocket.toUpperCase()}).`,
        );
      }
    } else {
      checks['cpu_motherboard'] = {
        ok: true,
        note: 'Socket data unavailable — verify compatibility manually.',
      };
    }
  }

  // ── 2. RAM ↔ Motherboard DDR generation ──
  if (ram && mb) {
    const ramDdr = extractDdr(ram.specs);
    const mbDdr = extractDdr(mb.specs);

    if (ramDdr && mbDdr) {
      const ok = ramDdr === mbDdr;
      checks['ram_motherboard'] = {
        ok,
        note: ok
          ? `DDR generation match: ${ramDdr.toUpperCase()}`
          : `DDR mismatch: RAM is ${ramDdr.toUpperCase()}, motherboard supports ${mbDdr.toUpperCase()}`,
      };
      if (!ok) {
        warnings.push(
          `RAM DDR type (${ramDdr.toUpperCase()}) does not match motherboard DDR support (${mbDdr.toUpperCase()}).`,
        );
      }
    } else {
      checks['ram_motherboard'] = {
        ok: true,
        note: 'DDR data unavailable — verify compatibility manually.',
      };
    }
  }

  // ── 3. PSU wattage ≥ estimated load ──
  if (psu) {
    const psuWattage = extractWattage(psu.specs);
    if (psuWattage !== null) {
      const cpuTdp = cpu ? extractTdp(cpu.specs) : null;
      const gpuTdp = gpu ? extractTdp(gpu.specs) : null;
      const estimatedLoad = (cpuTdp ?? 65) + (gpuTdp ?? 75) + 100;
      const ok = psuWattage >= estimatedLoad;

      checks['psu_load'] = {
        ok,
        note: ok
          ? `${psuWattage} W PSU sufficient (estimated load: ~${estimatedLoad} W)`
          : `${psuWattage} W PSU may be insufficient (estimated load: ~${estimatedLoad} W)`,
      };
      if (!ok) {
        warnings.push(
          `PSU (${psuWattage} W) may be insufficient — estimated build load is ~${estimatedLoad} W.`,
        );
      }
    }
  }

  // ── 4. Cabinet ↔ Motherboard form factor ──
  if (cabinet && mb) {
    const cabinetFf = extractFormFactor(cabinet.specs);
    const mbFf = extractFormFactor(mb.specs);

    if (cabinetFf && mbFf) {
      const supported = CABINET_SUPPORTS[cabinetFf] ?? [cabinetFf];
      const ok = supported.includes(mbFf);

      checks['cabinet_motherboard'] = {
        ok,
        note: ok
          ? `Form factor compatible: case=${cabinetFf.toUpperCase()}, motherboard=${mbFf.toUpperCase()}`
          : `Form factor incompatible: case=${cabinetFf.toUpperCase()} does not support ${mbFf.toUpperCase()}`,
      };
      if (!ok) {
        warnings.push(
          `Cabinet (${cabinetFf.toUpperCase()}) does not support the motherboard form factor (${mbFf.toUpperCase()}).`,
        );
      }
    } else {
      checks['cabinet_motherboard'] = {
        ok: true,
        note: 'Form factor data unavailable — verify compatibility manually.',
      };
    }
  }

  return { checks, warnings };
};
