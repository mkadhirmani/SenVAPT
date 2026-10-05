/**
 * Domain & Corporate Brand Name Utilities
 * Accurately resolves apex/root domains and company brand names from any target URL,
 * preventing subdomains (e.g., plus.sennovate.com) from incorrectly replacing the primary
 * corporate brand with subdomain prefixes (e.g., "Plus Inc").
 */

// Common two-part country-code top-level domains (ccTLDs)
const TWO_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk', 'gov.uk',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in', 'nic.in', 'ac.in', 'edu.in', 'res.in', 'gov.in',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'govt.nz', 'geek.nz', 'gen.nz', 'school.nz',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'co.jp', 'ne.jp', 'or.jp', 'go.jp', 'ac.jp', 'ad.jp', 'ed.jp', 'gr.jp', 'lg.jp',
  'com.sg', 'net.sg', 'org.sg', 'gov.sg', 'edu.sg', 'per.sg',
  'com.my', 'net.my', 'org.my', 'gov.my', 'edu.my', 'mil.my',
  'com.mx', 'net.mx', 'org.mx', 'gob.mx', 'edu.mx',
  'co.za', 'net.za', 'org.za', 'gov.za', 'ac.za', 'edu.za',
  'com.ph', 'net.ph', 'org.ph', 'gov.ph', 'edu.ph',
  'com.hk', 'net.hk', 'org.hk', 'gov.hk', 'edu.hk', 'idv.hk',
  'com.tw', 'net.tw', 'org.tw', 'gov.tw', 'edu.tw', 'idv.tw',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.tr', 'net.tr', 'org.tr', 'gov.tr', 'edu.tr',
  'com.ar', 'net.ar', 'org.ar', 'gob.ar', 'edu.ar'
]);

// Generic/placeholder names that should always be replaced by actual domain brand
const GENERIC_COMPANY_NAMES = new Set([
  'target',
  'target organization',
  'security audit target',
  'custom target',
  'custom scan target',
  'target system',
  'unknown target',
  'example',
  'example inc'
]);

/**
 * Format raw brand string to capitalized presentation format
 * e.g. "sennovate" -> "Sennovate", "beta-energy" -> "Beta-Energy"
 */
function formatBrandCapitalization(brand) {
  if (!brand) return 'Target';
  return brand
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');
}

/**
 * Extract root domain, brand name, and clean company name from any target string
 * @param {string} rawInput - e.g. "https://plus.sennovate.com/api", "sennovate", "learning.aws.sennovate.com"
 * @param {string} [fallbackPreferredName] - optional user-provided name
 */
export function extractDomainInfo(rawInput, fallbackPreferredName = '') {
  let str = String(rawInput || '').trim();

  // If input is empty, fallback to preferred name
  if (!str && fallbackPreferredName) {
    str = String(fallbackPreferredName).trim();
  }

  if (!str) {
    return {
      cleanDomain: 'target.com',
      rootDomain: 'target.com',
      brandName: 'Target',
      brandSlug: 'target',
      companyName: 'Target Organization',
      subdomain: '',
      fullHost: 'target.com'
    };
  }

  // Strip protocols, port, query params, hash, and trailing paths
  str = str.replace(/^https?:\/\//i, '');
  str = str.split('/')[0].split('?')[0].split('#')[0].split(':')[0].trim().toLowerCase();

  // Remove leading www.
  if (str.startsWith('www.')) {
    str = str.slice(4);
  }

  // Handle single word inputs without dots (e.g. "sennovate")
  if (!str.includes('.')) {
    const brandName = formatBrandCapitalization(str);
    const rootDomain = `${str}.com`;
    return {
      cleanDomain: str,
      rootDomain,
      brandName,
      brandSlug: str.toLowerCase(),
      companyName: `${brandName} Inc`,
      subdomain: '',
      fullHost: rootDomain
    };
  }

  const parts = str.split('.').filter(Boolean);
  if (parts.length === 1) {
    const brandName = formatBrandCapitalization(parts[0]);
    const rootDomain = `${parts[0]}.com`;
    return {
      cleanDomain: str,
      rootDomain,
      brandName,
      brandSlug: parts[0].toLowerCase(),
      companyName: `${brandName} Inc`,
      subdomain: '',
      fullHost: rootDomain
    };
  }

  let rootDomain = '';
  let brandPart = '';
  let subdomainPart = '';

  // Check two-part TLD (e.g. example.co.uk)
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  const isTwoPart = TWO_PART_TLDS.has(lastTwo) || (parts.length >= 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2);

  if (isTwoPart && parts.length >= 3) {
    rootDomain = parts.slice(-3).join('.');
    brandPart = parts[parts.length - 3];
    subdomainPart = parts.slice(0, -3).join('.');
  } else if (parts.length >= 2) {
    rootDomain = parts.slice(-2).join('.');
    brandPart = parts[parts.length - 2];
    subdomainPart = parts.slice(0, -2).join('.');
  } else {
    rootDomain = str;
    brandPart = parts[0];
  }

  const brandName = formatBrandCapitalization(brandPart);
  const brandSlug = brandPart.toLowerCase();
  const companyName = rootDomain; // Fetch only the domain name (e.g., "sennovate.com")

  return {
    cleanDomain: str,
    rootDomain,
    domainName: rootDomain,
    companyName: rootDomain,
    brandName,
    brandSlug,
    subdomain: subdomainPart,
    fullHost: str
  };
}

/**
 * Sanitize corporate / organization name against target domain
 * Strictly extracts and returns ONLY the apex/root domain name (e.g. "sennovate.com"
 * from "https://plus.sennovate.com"), stripping away any subdomain prefixes ("plus.")
 * and synthetic suffixes ("Plus Inc").
 *
 * @param {string} currentCompanyName - Current company name candidate
 * @param {string} targetUrlOrDomain - Target URL or domain of the scan
 * @returns {string} Sanitized domain name for company display
 */
export function sanitizeCompanyName(currentCompanyName, targetUrlOrDomain) {
  // 1. If targetUrlOrDomain is provided, fetch ONLY the root domain name from it
  if (targetUrlOrDomain && typeof targetUrlOrDomain === 'string' && targetUrlOrDomain.trim()) {
    const domainInfo = extractDomainInfo(targetUrlOrDomain);
    if (domainInfo && domainInfo.rootDomain && domainInfo.rootDomain !== 'target.com') {
      return domainInfo.rootDomain;
    }
  }

  // 2. If currentCompanyName itself contains a domain or URL, extract root domain from it
  if (currentCompanyName && typeof currentCompanyName === 'string' && currentCompanyName.trim()) {
    const raw = currentCompanyName.trim();
    if (raw.includes('.') || raw.startsWith('http')) {
      const domainInfo = extractDomainInfo(raw);
      if (domainInfo && domainInfo.rootDomain && domainInfo.rootDomain !== 'target.com') {
        return domainInfo.rootDomain;
      }
    }
  }

  // 3. Fallback to targetUrlOrDomain if present
  if (targetUrlOrDomain) {
    const domainInfo = extractDomainInfo(targetUrlOrDomain);
    if (domainInfo && domainInfo.rootDomain) {
      return domainInfo.rootDomain;
    }
  }

  const rawCurrent = String(currentCompanyName || '').trim();
  if (!rawCurrent || GENERIC_COMPANY_NAMES.has(rawCurrent.toLowerCase())) {
    return 'target.com';
  }

  return rawCurrent;
}

/**
 * Get clean root domain for display (e.g. "sennovate.com")
 */
export function getDisplayDomain(targetUrlOrDomain) {
  const info = extractDomainInfo(targetUrlOrDomain);
  return info.rootDomain || 'target.com';
}
