import { SCAN_METADATA, VULNERABILITIES } from './scanData';
import { getAuthHeaders } from '../utils/auth';

export const SAMPLE_BETA_VULNERABILITIES = [
  {
    id: "vuln-0004",
    title: "Unrestricted File Upload in Customer Inquiry Form",
    severity: "HIGH",
    cvss: 8.2,
    cwe: "CWE-434",
    target: "https://portal.beta-energy.internal/contact/submit-attachment",
    endpoint: "/contact/submit-attachment",
    description: "The customer attachment upload handler performs client-side only MIME-type verification without verifying server-side magic bytes or file extensions. An attacker can upload arbitrary executable scripts (.php, .phtml) to the web server.",
    impact: "Remote Code Execution (RCE) on the web server hosting customer portals and feedback systems.",
    technicalAnalysis: "Multipart form upload bypassed extension validation by utilizing double extensions (`payload.php.pdf`) which were placed into the web-accessible `/uploads/feedback/` directory.",
    pocDescription: "POST request uploading executable payload bypassing MIME filter.",
    reproduction: `curl -X POST "https://portal.beta-energy.internal/contact/submit-attachment" \\
  -F "file=@poc.php;type=image/png" \\
  -F "comment=Verification Audit"`,
    remediation: "Enforce strict server-side file extension allowlists, inspect magic bytes, store uploaded files outside web root or in an isolated S3 bucket, and disable script execution in upload folders.",
    remediationSteps: [
      "Store uploaded files outside the web root or on isolated object storage.",
      "Validate magic bytes and strictly allow only PDF, JPG, and PNG extensions.",
      "Disable script execution in upload directories."
    ],
    evidence: "HTTP/1.1 200 OK\n{\"uploaded\":true,\"path\":\"/uploads/feedback/poc.php\"}",
    fixEffort: "4-8 Hours"
  },
  {
    id: "vuln-0001",
    title: "Broken Object Level Authorization (BOLA) in Customer Account API",
    severity: "MEDIUM",
    cvss: 6.5,
    cwe: "CWE-284",
    target: "https://portal.beta-energy.internal/api/v1/accounts/details",
    endpoint: "/api/v1/accounts/details",
    description: "The customer portal API endpoint `/api/v1/accounts/details` fails to validate that the authenticated session user matches the requested `accountId` parameter in the request body. An attacker with a valid low-privilege customer account can enumerate and access sensitive billing records and personal identifiable information (PII).",
    impact: "Unauthorized exposure of member billing history, meter telemetry, and account addresses across the customer network.",
    technicalAnalysis: "During autonomous REST endpoint fuzzing, parameter tampering on `accountId` returned `HTTP 200 OK` with full JSON payload belonging to disparate customer tenants without requiring re-authentication.",
    pocDescription: "Sends authenticated curl request with hijacked account ID header to extract customer record.",
    reproduction: `curl -X POST "https://portal.beta-energy.internal/api/v1/accounts/details" \\
  -H "Authorization: Bearer <VALID_MEMBER_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"accountId": "ACC-MEM-0098412", "includeBilling": true}'`,
    remediation: "Implement strict authorization checks verifying that the requesting user's identity token matches the owner of the requested accountId record.",
    remediationSteps: [
      "Validate user ownership of the requested account in backend API middleware before database lookup.",
      "Replace sequential member IDs with cryptographically secure random GUIDs.",
      "Implement automated API gateway authorization policies."
    ],
    evidence: "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"status\":\"success\",\"member\":\"Jane Doe\",\"meterId\":\"MTR-98214\",\"balance\":142.50}",
    fixEffort: "4-8 Hours"
  },
  {
    id: "vuln-0002",
    title: "Reflected Cross-Site Scripting (XSS) in Portal Search",
    severity: "MEDIUM",
    cvss: 6.1,
    cwe: "CWE-79",
    target: "https://portal.beta-energy.internal/search",
    endpoint: "/search?q=",
    description: "The search query parameter `?q=` in the portal reflects user input directly into the DOM without sanitization or HTML entity encoding, allowing arbitrary script execution in the context of the user's browser session.",
    impact: "Session hijacking of authenticated customer sessions and credential theft.",
    technicalAnalysis: "Input `<script>alert(document.domain)</script>` supplied to `?q=` parameter was reflected unsanitized inside the `<div class=\"search-feedback\">` block.",
    pocDescription: "Crafted URL triggering JavaScript execution in victim browser.",
    reproduction: `https://portal.beta-energy.internal/search?q=%3Cscript%3Econsole.log(document.cookie)%3C/script%3E`,
    remediation: "Properly sanitize and HTML-encode all user input before rendering into HTML templates, and enforce a strict Content Security Policy (CSP).",
    remediationSteps: [
      "Use contextual HTML encoding on the search query parameter.",
      "Deploy a Content Security Policy (CSP) blocking inline scripts (script-src 'self').",
      "Sanitize client-side rendering with DOMPurify."
    ],
    evidence: "<div class=\"search-results\">\n  <p>Search for: <script>console.log(document.cookie)</script></p>\n</div>",
    fixEffort: "2-4 Hours"
  },
  {
    id: "vuln-0003",
    title: "Missing Security Headers & Subdomain Information Disclosure",
    severity: "MEDIUM",
    cvss: 5.3,
    cwe: "CWE-200",
    target: "https://portal.beta-energy.internal/",
    endpoint: "/",
    description: "The primary web application fails to include Content-Security-Policy (CSP), Permissions-Policy, and X-Content-Type-Options headers. Furthermore, the web server response discloses internal infrastructure and server versions in `Server` and `X-Powered-By` headers.",
    impact: "Aids threat actors in fingerprinting backend architecture and increases susceptibility to clickjacking and MIME-sniffing attacks.",
    technicalAnalysis: "HTTP response headers inspection revealed `Server: Apache/2.4.52` along with complete absence of modern defense-in-depth headers.",
    pocDescription: "Verify missing response headers via curl HEAD request.",
    reproduction: `curl -sI https://portal.beta-energy.internal/ | grep -Ei "(Server|X-Powered-By|Content-Security|X-Frame)"`,
    remediation: "Configure reverse proxy / web server to strip server banners and inject hardened security headers.",
    remediationSteps: [
      "Add 'X-Content-Type-Options: nosniff' header.",
      "Add 'X-Frame-Options: SAMEORIGIN' or frame-ancestors CSP directive.",
      "Disable server signature tokens in web server configuration."
    ],
    evidence: "Server: Apache/2.4.52\n(No Content-Security-Policy header present)",
    fixEffort: "1-2 Hours"
  }
];

export const SAMPLE_BETA_ATTACK_CHAIN = {
  title: "Remote File Upload to Member Data Access Chain",
  targetHost: "portal.beta-energy.internal",
  steps: [
    {
      step: 1,
      name: "Public Asset Reconnaissance",
      target: "https://portal.beta-energy.internal/contact/submit-attachment",
      findingRef: "vuln-0004",
      action: "Autonomous endpoint discovery identified unrestricted multipart file upload in the inquiry interface.",
      impact: "Identified writable upload directory without server-side extension enforcement."
    },
    {
      step: 2,
      name: "MIME Filter Bypass & Web Shell Upload",
      target: "https://portal.beta-energy.internal/contact/submit-attachment",
      findingRef: "vuln-0004",
      action: "Uploaded double-extension payload (payload.php.pdf) with spoofed image/png Content-Type header.",
      impact: "Web shell successfully written to web-accessible /uploads/feedback/ directory."
    },
    {
      step: 3,
      name: "Remote Code Execution & Server Compromise",
      target: "https://portal.beta-energy.internal/uploads/feedback/poc.php",
      findingRef: "vuln-0004",
      action: "Invoked uploaded script over HTTP GET, achieving command execution under www-data context.",
      impact: "Full read access to local configuration files and internal API tokens."
    },
    {
      step: 4,
      name: "Internal API Pivot & BOLA Exploitation",
      target: "https://portal.beta-energy.internal/api/v1/accounts/details",
      findingRef: "vuln-0001",
      action: "Leveraged internal service token to enumerate customer account IDs across member database.",
      impact: "Unauthorized extraction of customer billing records, meter telemetry, and addresses."
    }
  ]
};

export const SAMPLE_ALPHA_VULNERABILITIES = [
  {
    id: "vuln-0004",
    title: "Unrestricted File Upload Handler in Contact Inquiry Form",
    severity: "HIGH",
    cvss: 8.4,
    cwe: "CWE-434",
    target: "https://cloud.alpha-corp.internal/contact/upload-inquiry",
    endpoint: "/contact/upload-inquiry",
    description: "The customer inquiry form handler performs client-side only MIME-type verification without validating server-side magic bytes or file extensions. An attacker can upload arbitrary executable scripts (.php, .phtml) to the web server.",
    impact: "Remote Code Execution (RCE) on the underlying web application server hosting corporate assets.",
    technicalAnalysis: "Multipart form upload bypassed extension validation by utilizing double extensions (`payload.php.pdf`) which were placed directly in the web-accessible `/uploads/inquiries/` directory.",
    pocDescription: "POST request uploading executable payload bypassing MIME filter.",
    reproduction: `curl -X POST "https://cloud.alpha-corp.internal/contact/upload-inquiry" \\
  -F "file=@poc.php;type=image/png" \\
  -F "company=Audit Verification"`,
    remediation: "Enforce strict server-side file extension allowlists, inspect magic bytes, store uploaded files outside web root or in an isolated S3 bucket, and disable script execution in upload folders.",
    remediationSteps: [
      "Store uploaded files outside the web root or on isolated object storage.",
      "Validate magic bytes and strictly allow only PDF, JPG, and PNG extensions.",
      "Disable script execution in upload directories."
    ],
    evidence: "HTTP/1.1 200 OK\n{\"uploaded\":true,\"path\":\"/uploads/inquiries/poc.php\"}",
    fixEffort: "4-8 Hours"
  },
  {
    id: "vuln-0002",
    title: "Reflected Cross-Site Scripting (XSS) in Product Catalog Search",
    severity: "HIGH",
    cvss: 7.2,
    cwe: "CWE-79",
    target: "https://cloud.alpha-corp.internal/search",
    endpoint: "/search?q=",
    description: "The product catalog search parameter `?q=` reflects user input directly into the DOM without sanitization or HTML entity encoding, allowing arbitrary script execution in the context of the user's browser session.",
    impact: "Session hijacking of authenticated portal sessions and credential theft.",
    technicalAnalysis: "Input `<script>alert(document.domain)</script>` supplied to `?q=` parameter was reflected unsanitized inside the `<div class=\"search-feedback\">` block.",
    pocDescription: "Crafted URL triggering JavaScript execution in victim browser.",
    reproduction: `https://cloud.alpha-corp.internal/search?q=%3Cscript%3Econsole.log(document.cookie)%3C/script%3E`,
    remediation: "Properly sanitize and HTML-encode all user input before rendering into HTML templates, and enforce a strict Content Security Policy (CSP).",
    remediationSteps: [
      "Use contextual HTML encoding on the search query parameter.",
      "Deploy a Content Security Policy (CSP) blocking inline scripts (script-src 'self').",
      "Sanitize client-side rendering with DOMPurify."
    ],
    evidence: "<div class=\"search-results\">\n  <p>Search for: <script>console.log(document.cookie)</script></p>\n</div>",
    fixEffort: "2-4 Hours"
  },
  {
    id: "vuln-0003",
    title: "Weak TLS/SSL Protocol Configuration & Deprecated Cipher Suites",
    severity: "MEDIUM",
    cvss: 5.8,
    cwe: "CWE-326",
    target: "https://cloud.alpha-corp.internal:443",
    endpoint: ":443",
    description: "The SSL/TLS configuration on port 443 supports deprecated TLS 1.0 and TLS 1.1 protocols and CBC-mode ciphers susceptible to cryptographic downgrade attacks.",
    impact: "Potential eavesdropping and decryption of encrypted traffic via man-in-the-middle (MitM) attacks.",
    technicalAnalysis: "TLS handshake probing confirmed negotiation with TLSv1.0 and weak ciphers including TLS_RSA_WITH_AES_128_CBC_SHA.",
    pocDescription: "Connect using openssl with TLS 1.0 flag.",
    reproduction: `openssl s_client -connect cloud.alpha-corp.internal:443 -tls1`,
    remediation: "Disable TLS 1.0 and 1.1; enforce TLS 1.2 and TLS 1.3 exclusively with forward secrecy cipher suites (ECDHE).",
    remediationSteps: [
      "Disable TLSv1.0 and TLSv1.1 in web server configuration.",
      "Enable modern cipher suites with perfect forward secrecy.",
      "Enable HSTS preload directive."
    ],
    evidence: "SSL-Session:\n    Protocol  : TLSv1\n    Cipher    : AES128-SHA",
    fixEffort: "1-2 Hours"
  },
  {
    id: "vuln-0001",
    title: "Missing Security Headers & Web Server Information Disclosure",
    severity: "MEDIUM",
    cvss: 5.5,
    cwe: "CWE-200",
    target: "https://cloud.alpha-corp.internal/",
    endpoint: "/",
    description: "The primary web application fails to implement modern defense-in-depth HTTP security headers including Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options, and X-Frame-Options.",
    impact: "Aids threat actors in fingerprinting backend architecture and exposes end-users to clickjacking and MIME-sniffing attacks.",
    technicalAnalysis: "Automated HTTP response probing verified that critical security headers are absent across web responses.",
    pocDescription: "Verify missing response headers via curl HEAD request against target.",
    reproduction: `curl -sI https://cloud.alpha-corp.internal/ | grep -Ei "(Server|X-Powered-By|Content-Security|X-Frame|Strict-Transport)"`,
    remediation: "Configure the web server to inject hardened OWASP security headers and disable public server signature banners.",
    remediationSteps: [
      "Add 'Content-Security-Policy: default-src \\'self\\'; frame-ancestors \\'none\\'' header.",
      "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' header.",
      "Add 'X-Content-Type-Options: nosniff' and 'X-Frame-Options: DENY' headers.",
      "Disable server version disclosure tokens in web server configuration."
    ],
    evidence: "HTTP/1.1 200 OK\n(Content-Security-Policy header: ABSENT)\n(Strict-Transport-Security: ABSENT)\n(X-Frame-Options: ABSENT)\n(X-Content-Type-Options: ABSENT)",
    fixEffort: "1-2 Hours"
  }
];

export const SAMPLE_ALPHA_ATTACK_CHAIN = {
  title: "Remote File Upload to Corporate Perimeter Access Chain",
  targetHost: "cloud.alpha-corp.internal",
  steps: [
    {
      step: 1,
      name: "Public Asset Reconnaissance",
      target: "https://cloud.alpha-corp.internal/contact/upload-inquiry",
      findingRef: "vuln-0004",
      action: "Autonomous endpoint discovery identified unrestricted multipart file upload in the inquiry interface.",
      impact: "Identified writable upload directory without server-side extension enforcement."
    },
    {
      step: 2,
      name: "MIME Filter Bypass & Payload Upload",
      target: "https://cloud.alpha-corp.internal/contact/upload-inquiry",
      findingRef: "vuln-0004",
      action: "Uploaded double-extension payload (payload.php.pdf) with spoofed image/png Content-Type header.",
      impact: "Payload successfully written to web-accessible /uploads/inquiries/ directory."
    },
    {
      step: 3,
      name: "Cross-Site Scripting Pivoting",
      target: "https://cloud.alpha-corp.internal/search",
      findingRef: "vuln-0002",
      action: "Injected script payload into product search parameter to demonstrate session token theft.",
      impact: "Arbitrary JavaScript execution in user browser session."
    },
    {
      step: 4,
      name: "Infrastructure Fingerprinting",
      target: "https://cloud.alpha-corp.internal/",
      findingRef: "vuln-0001",
      action: "Extracted server signature banners and cryptographic suite information.",
      impact: "Confirmed absence of CSP and HSTS protections across the corporate perimeter."
    }
  ]
};

export const INITIAL_SCAN_HISTORY = [];

export function getStoredScanHistory() {
  try {
    const stored = localStorage.getItem('sennovate_scan_history');
    let list = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {}
    }

    // Strictly filter out any default mock example scans (Alpha Financial Cloud, Beta Energy Network, Gamma Enterprise Systems)
    const MOCK_SCAN_IDS = new Set([
      'scan-alpha-corp_406f',
      'scan-beta-portal_81f4',
      'scan-gamma-estate_93f0'
    ]);
    const MOCK_NAMES = new Set([
      'alpha financial cloud',
      'beta energy network',
      'gamma enterprise systems'
    ]);

    list = list.filter(s => {
      if (!s) return false;
      if (MOCK_SCAN_IDS.has(s.id)) return false;
      const cName = (s.companyName || '').toLowerCase().trim();
      if (MOCK_NAMES.has(cName)) return false;
      return true;
    });

    // Preserve each scan's distinct findings, tokens, cost, user attribution, and timestamps
    const enrichedList = list.map(scan => {
      let vulns = Array.isArray(scan.vulnerabilities) ? scan.vulnerabilities : [];

      const critCount = vulns.filter(v => v.severity === 'CRITICAL').length;
      const highCount = vulns.filter(v => v.severity === 'HIGH').length;
      const medCount = vulns.filter(v => v.severity === 'MEDIUM').length;
      const lowCount = vulns.filter(v => v.severity === 'LOW').length;

      const riskScore = vulns.length > 0 ? (vulns[0]?.cvss || 5.5) : (scan.riskScore || 4.0);
      const riskLevel = critCount > 0 ? 'CRITICAL' : (highCount > 0 ? 'HIGH' : (vulns.length > 0 ? 'ELEVATED' : (scan.riskLevel || 'LOW')));

      const tokens = typeof scan.tokens === 'number' ? scan.tokens : (typeof scan.metadata?.tokens === 'number' ? scan.metadata.tokens : 0);
      const requests = typeof scan.requests === 'number' ? scan.requests : (typeof scan.metadata?.requests === 'number' ? scan.metadata.requests : 0);
      const cost = typeof scan.cost === 'number' ? scan.cost : (typeof scan.metadata?.cost === 'number' ? scan.metadata.cost : 0);
      const durationSec = scan.durationSec || scan.metadata?.durationSec || 240;
      const duration = scan.duration || `${Math.max(1, Math.round(durationSec / 60))} min`;
      const createdBy = scan.createdBy || scan.scannedBy || 'admin';
      const scannedBy = scan.scannedBy || createdBy;
      const scannedByName = scan.scannedByName ? scan.scannedByName : (scannedBy === 'admin' ? 'Administrator' : (scannedBy.startsWith('user') ? 'User' : scannedBy));
      const userRole = scan.userRole || (scannedBy === 'admin' ? 'Administrator' : 'User');

      return {
        ...scan,
        createdBy,
        scannedBy,
        scannedByName,
        userRole,
        tokens,
        requests,
        cost,
        durationSec,
        duration,
        vulnerabilities: vulns,
        findingsCount: vulns.length,
        critCount,
        highCount,
        medCount,
        lowCount,
        riskScore,
        riskLevel,
        metadata: {
          ...(scan.metadata || {}),
          createdBy,
          scannedBy,
          scannedByName,
          userRole,
          totalFindings: vulns.length,
          critCount,
          highCount,
          medCount,
          lowCount,
          overallRiskScore: riskScore,
          overallRiskLevel: riskLevel,
          tokens,
          requests,
          cost,
          durationSec
        }
      };
    });

    saveScanHistory(enrichedList);
    return enrichedList;
  } catch (e) {
    console.error('Error reading scan history:', e);
  }

  return [];
}

export function saveScanHistory(historyList) {
  try {
    localStorage.setItem('sennovate_scan_history', JSON.stringify(historyList));
  } catch (e) {
    console.error('Error saving scan history to localStorage:', e);
  }

  // Persist to backend server so all sessions see the latest scans
  try {
    fetch('/api/scans/save-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(historyList)
    }).catch(err => console.warn('Note syncing scan history to backend:', err.message));
  } catch (_) {}
}

/**
 * Fetch and merge scan history from the backend server
 */
export async function syncScanHistoryWithServer() {
  try {
    const res = await fetch('/api/scans/get-history', {
      headers: { ...getAuthHeaders() }
    });
    if (res.ok) {
      const data = await res.json();
      const local = getStoredScanHistory();
      const serverScans = (data && data.success && Array.isArray(data.scans)) ? data.scans : [];

      const scanMap = new Map();
      for (const s of serverScans) {
        if (s && s.id) scanMap.set(s.id, s);
      }
      for (const s of local) {
        if (s && s.id && !scanMap.has(s.id)) {
          scanMap.set(s.id, s);
        }
      }

      const merged = Array.from(scanMap.values());
      if (merged.length > 0) {
        localStorage.setItem('sennovate_scan_history', JSON.stringify(merged));
        
        // If local had scans that the server was missing, upload back to server
        if (merged.length > serverScans.length) {
          saveScanHistory(merged);
        }
        return merged;
      }
    }
  } catch (e) {
    console.warn('Note syncing scan history from backend server:', e);
  }
  return getStoredScanHistory();
}
