/**
 * Severity Classification, Sorting & Theme Token Utilities
 * Provides distinct visual differentiation for vulnerability severities:
 * - CRITICAL: Crimson Red (#ef4444 / #dc2626)
 * - HIGH: Vivid Flame Orange (#f97316 / #ea580c) - clearly separated from Medium
 * - MEDIUM: Bright Golden Yellow (#facc15 / #eab308) - clearly separated from High
 * - LOW: Electric Sky Blue (#0ea5e9 / #0284c7)
 * - INFO: Cool Slate (#64748b)
 */

export const SEVERITY_RANKS = {
  'CRITICAL': 4,
  'HIGH': 3,
  'MEDIUM': 2,
  'LOW': 1,
  'INFO': 0
};

/**
 * Returns a numeric priority rank for severity comparison (Higher = More Severe)
 */
export function getSeverityRank(severity) {
  if (!severity) return -1;
  const s = String(severity).toUpperCase().trim();
  if (s.includes('CRIT')) return 4;
  if (s.includes('HIGH')) return 3;
  if (s.includes('MED')) return 2;
  if (s.includes('LOW')) return 1;
  if (s.includes('INFO')) return 0;
  return -1;
}

/**
 * Normalizes any severity string to standard canonical uppercase form
 */
export function normalizeSeverity(severity) {
  const rank = getSeverityRank(severity);
  switch (rank) {
    case 4: return 'CRITICAL';
    case 3: return 'HIGH';
    case 2: return 'MEDIUM';
    case 1: return 'LOW';
    case 0: return 'INFO';
    default: return 'INFO';
  }
}

/**
 * Sorts vulnerabilities in guaranteed order:
 * 1. Severity Rank: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
 * 2. CVSS Score descending (e.g. 9.8 -> 8.2 -> 6.5)
 * 3. Title / ID alphabetically
 */
export function sortVulnerabilities(vulnerabilities) {
  if (!Array.isArray(vulnerabilities)) return [];
  return [...vulnerabilities].sort((a, b) => {
    const rankA = getSeverityRank(a?.severity);
    const rankB = getSeverityRank(b?.severity);
    if (rankB !== rankA) {
      return rankB - rankA;
    }

    const cvssA = typeof a?.cvss === 'number' ? a.cvss : (parseFloat(a?.cvss) || 0);
    const cvssB = typeof b?.cvss === 'number' ? b.cvss : (parseFloat(b?.cvss) || 0);
    if (cvssB !== cvssA) {
      return cvssB - cvssA;
    }

    return (a?.title || '').localeCompare(b?.title || '');
  });
}

/**
 * Returns complete visual styling tokens for a given severity
 */
export function getSeverityStyles(severity) {
  const norm = normalizeSeverity(severity);
  switch (norm) {
    case 'CRITICAL':
      return {
        label: 'CRITICAL',
        rank: 4,
        badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
        strip: 'bg-red-600',
        dot: 'bg-red-500 shadow-sm shadow-red-500/40',
        text: 'text-red-600 dark:text-red-400',
        pill: 'bg-red-600 text-white font-black shadow-sm shadow-red-600/30',
        hex: '#dc2626'
      };
    case 'HIGH':
      return {
        label: 'HIGH',
        rank: 3,
        // Vivid Flame Orange - strongly differentiated from yellow/amber
        badge: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700 font-extrabold',
        strip: 'bg-orange-500',
        dot: 'bg-orange-500 shadow-sm shadow-orange-500/40',
        text: 'text-orange-600 dark:text-orange-400',
        pill: 'bg-orange-500 text-white font-extrabold shadow-sm shadow-orange-500/30',
        hex: '#ea580c'
      };
    case 'MEDIUM':
      return {
        label: 'MEDIUM',
        rank: 2,
        // Bright Canary / Golden Yellow - strongly differentiated from orange
        badge: 'bg-yellow-50 text-yellow-900 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-700 font-extrabold',
        strip: 'bg-yellow-400',
        dot: 'bg-yellow-400 shadow-sm shadow-yellow-400/40',
        text: 'text-yellow-700 dark:text-yellow-400',
        pill: 'bg-yellow-400 text-yellow-950 font-extrabold shadow-sm shadow-yellow-400/30',
        hex: '#ca8a04'
      };
    case 'LOW':
      return {
        label: 'LOW',
        rank: 1,
        badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        strip: 'bg-sky-400',
        dot: 'bg-sky-400 shadow-sm shadow-sky-400/40',
        text: 'text-sky-600 dark:text-sky-400',
        pill: 'bg-sky-500 text-white font-semibold',
        hex: '#0284c7'
      };
    default:
      return {
        label: 'INFO',
        rank: 0,
        badge: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        strip: 'bg-slate-400',
        dot: 'bg-slate-400',
        text: 'text-slate-600 dark:text-slate-400',
        pill: 'bg-slate-500 text-white font-medium',
        hex: '#64748b'
      };
  }
}
