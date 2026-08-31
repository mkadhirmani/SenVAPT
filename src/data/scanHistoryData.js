import { SCAN_METADATA, VULNERABILITIES } from './scanData';
import { getAuthHeaders } from '../utils/auth';

export const SMECO_VULNERABILITIES = [
  {
    id: "vuln-0004",
    title: "Unrestricted File Upload in Contact & Member Feedback Form",
    severity: "HIGH",
    cvss: 8.2,
    cwe: "CWE-434",
    target: "https://www.smeco.coop/contact/submit-attachment",
    endpoint: "/contact/submit-attachment",
    description: "The contact attachment upload handler performs client-side only MIME-type verification without verifying server-side magic bytes or file extensions. An attacker can upload arbitrary executable scripts (.php, .phtml) to the web server.",
    impact: "Remote Code Execution (RCE) on the web server hosting customer portals and member feedback systems.",
    technicalAnalysis: "Multipart form upload bypassed extension validation by utilizing double extensions (`payload.php.pdf`) which were executed by the backend PHP interpreter in `/uploads/feedback/`.",
    pocDescription: "POST request uploading executable payload bypassing MIME filter.",
    reproduction: `curl -X POST "https://www.smeco.coop/contact/submit-attachment" \\
  -F "file=@poc.php;type=image/png" \\
  -F "comment=Member inquiry verification"`,
    remediation: "Enforce strict server-side file extension allowlists, inspect magic bytes, store uploaded files outside web root or in an isolated S3 bucket, and disable script execution in upload folders.",
    remediationSteps: [
      "Store uploaded files outside the web root or on isolated object storage.",
      "Validate magic bytes and strictly allow only PDF, JPG, and PNG extensions.",
      "Disable script execution (e.g. PHP execution) in upload directories."
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
    target: "https://www.smeco.coop/api/v1/accounts/details",
    endpoint: "/api/v1/accounts/details",
    description: "The customer portal API endpoint `/api/v1/accounts/details` fails to validate that the authenticated session user matches the requested `accountId` parameter in the request body. An attacker with a valid low-privilege customer account can enumerate and access sensitive billing records, consumption history, and personal identifiable information (PII) of any cooperative member.",
    impact: "Unauthorized exposure of member billing history, meter telemetry, and account addresses across the customer network.",
    technicalAnalysis: "During autonomous REST endpoint fuzzing, parameter tampering on `accountId` returned `HTTP 200 OK` with full JSON payload belonging to disparate customer tenants without requiring re-authentication.",
    pocDescription: "Sends authenticated curl request with hijacked account ID header to extract customer record.",
    reproduction: `curl -X POST "https://www.smeco.coop/api/v1/accounts/details" \\
  -H "Authorization: Bearer <VALID_MEMBER_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"accountId": "SMECO-MEM-0098412", "includeBilling": true}'`,
    remediation: "Implement strict authorization checks verifying that the requesting user's identity token matches the owner of the requested accountId record.",
    remediationSteps: [
      "Validate user ownership of the requested account in backend API middleware before database lookup.",
      "Replace sequential member IDs with cryptographically secure random GUIDs.",
      "Implement automated API gateway authorization policies."
    ],
    evidence: "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"status\":\"success\",\"member\":\"John Doe\",\"meterId\":\"MTR-98214\",\"balance\":142.50}",
    fixEffort: "4-8 Hours"
  },
  {
    id: "vuln-0002",
    title: "Reflected Cross-Site Scripting (XSS) in Outage Center Search",
    severity: "MEDIUM",
    cvss: 6.1,
    cwe: "CWE-79",
    target: "https://www.smeco.coop/outage-center/search",
    endpoint: "/outage-center/search",
    description: "The search query parameter `?q=` in the Outage Center portal reflects user input directly into the DOM without sanitization or HTML entity encoding, allowing arbitrary script execution in the context of the user's browser session.",
    impact: "Session hijacking of authenticated customer sessions, phishing injection on the official utility outage map, and credential theft.",
    technicalAnalysis: "Input `<script>alert(document.domain)</script>` supplied to `?q=` parameter was reflected unsanitized inside the `<div class=\"search-feedback\">` block.",
    pocDescription: "Crafted URL triggering JavaScript execution in victim browser.",
    reproduction: `https://www.smeco.coop/outage-center/search?q=%3Cscript%3Econsole.log(document.cookie)%3C/script%3E`,
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
    target: "https://www.smeco.coop/",
    endpoint: "/",
    description: "The primary web application fails to include Content-Security-Policy (CSP), Permissions-Policy, and X-Content-Type-Options headers. Furthermore, the web server response discloses internal proxy infrastructure and server versions in `Server` and `X-Powered-By` headers.",
    impact: "Aids threat actors in fingerprinting backend architecture and increases susceptibility to clickjacking and MIME-sniffing attacks.",
    technicalAnalysis: "HTTP response headers inspect revealed `Server: Apache/2.4.52 (Ubuntu)` and `X-Powered-By: PHP/8.1.2`, along with complete absence of modern defense-in-depth headers.",
    pocDescription: "Verify missing response headers via curl HEAD request.",
    reproduction: `curl -sI https://www.smeco.coop/ | grep -Ei "(Server|X-Powered-By|Content-Security|X-Frame)"`,
    remediation: "Configure reverse proxy / web server to strip server banners and inject hardened security headers.",
    remediationSteps: [
      "Add 'X-Content-Type-Options: nosniff' header.",
      "Add 'X-Frame-Options: SAMEORIGIN' or frame-ancestors CSP directive.",
      "Disable server signature tokens in Apache/Nginx configuration."
    ],
    evidence: "Server: Apache/2.4.52 (Ubuntu)\nX-Powered-By: PHP/8.1.2\n(No Content-Security-Policy header present)",
    fixEffort: "1-2 Hours"
  }
];

export const SMECO_ATTACK_CHAIN = {
  title: "Remote File Upload to Member Data Access Chain",
  targetHost: "smeco.coop",
  steps: [
    {
      step: 1,
      name: "Public Asset Reconnaissance",
      target: "https://www.smeco.coop/contact/submit-attachment",
      findingRef: "vuln-0004",
      action: "Autonomous endpoint discovery identified unrestricted multipart file upload in the member inquiry interface.",
      impact: "Identified writable upload directory without server-side extension enforcement."
    },
    {
      step: 2,
      name: "MIME Filter Bypass & Web Shell Upload",
      target: "https://www.smeco.coop/contact/submit-attachment",
      findingRef: "vuln-0004",
      action: "Uploaded double-extension payload (payload.php.pdf) with spoofed image/png Content-Type header.",
      impact: "Web shell successfully written to web-accessible /uploads/feedback/ directory."
    },
    {
      step: 3,
      name: "Remote Code Execution & Server Compromise",
      target: "https://www.smeco.coop/uploads/feedback/poc.php",
      findingRef: "vuln-0004",
      action: "Invoked uploaded script over HTTP GET, achieving command execution under www-data context.",
      impact: "Full read access to local configuration files and internal API tokens."
    },
    {
      step: 4,
      name: "Internal API Pivot & BOLA Exploitation",
      target: "https://www.smeco.coop/api/v1/accounts/details",
      findingRef: "vuln-0001",
      action: "Leveraged internal service token to enumerate customer account IDs across member database.",
      impact: "Unauthorized extraction of customer billing records, meter telemetry, and addresses."
    }
  ]
};

export const EMCOCHEM_VULNERABILITIES = [
  {
    id: "vuln-0004",
    title: "Unrestricted File Upload Handler in Contact Inquiry Form",
    severity: "HIGH",
    cvss: 8.4,
    cwe: "CWE-434",
    target: "https://www.emcochem.com/contact/upload-inquiry",
    endpoint: "/contact/upload-inquiry",
    description: "The contact and customer inquiry form handler performs client-side only MIME-type verification without validating server-side magic bytes or file extensions. An attacker can upload arbitrary executable scripts (.php, .phtml) to the web server.",
    impact: "Remote Code Execution (RCE) on the underlying web application server hosting corporate assets.",
    technicalAnalysis: "Multipart form upload bypassed extension validation by utilizing double extensions (`payload.php.pdf`) which were placed directly in the web-accessible `/uploads/inquiries/` directory.",
    pocDescription: "POST request uploading executable payload bypassing MIME filter.",
    reproduction: `curl -X POST "https://www.emcochem.com/contact/upload-inquiry" \\
  -F "file=@poc.php;type=image/png" \\
  -F "company=Emcochem Audit Verification"`,
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
    target: "https://www.emcochem.com/search",
    endpoint: "/search?q=",
    description: "The product catalog search parameter `?q=` reflects user input directly into the DOM without sanitization or HTML entity encoding, allowing arbitrary script execution in the context of the user's browser session.",
    impact: "Session hijacking of authenticated portal sessions, phishing injection on the official corporate site, and credential theft.",
    technicalAnalysis: "Input `<script>alert(document.domain)</script>` supplied to `?q=` parameter was reflected unsanitized inside the `<div class=\"search-feedback\">` block.",
    pocDescription: "Crafted URL triggering JavaScript execution in victim browser.",
    reproduction: `https://www.emcochem.com/search?q=%3Cscript%3Econsole.log(document.cookie)%3C/script%3E`,
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
    target: "https://www.emcochem.com:443",
    endpoint: ":443",
    description: "The SSL/TLS configuration on port 443 supports deprecated TLS 1.0 and TLS 1.1 protocols and CBC-mode ciphers susceptible to cryptographic downgrade attacks.",
    impact: "Potential eavesdropping and decryption of encrypted traffic via man-in-the-middle (MitM) attacks.",
    technicalAnalysis: "TLS handshake probing confirmed negotiation with TLSv1.0 and weak ciphers including TLS_RSA_WITH_AES_128_CBC_SHA.",
    pocDescription: "Connect using openssl with TLS 1.0 flag.",
    reproduction: `openssl s_client -connect www.emcochem.com:443 -tls1`,
    remediation: "Disable TLS 1.0 and 1.1; enforce TLS 1.2 and TLS 1.3 exclusively with forward secrecy cipher suites (ECDHE).",
    remediationSteps: [
      "Disable TLSv1.0 and TLSv1.1 in Nginx/Apache configuration.",
      "Enable modern cipher suites with perfect forward secrecy (ECDHE-ECDSA-AES128-GCM-SHA256).",
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
    target: "https://www.emcochem.com/",
    endpoint: "/",
    description: "The primary web application fails to implement modern defense-in-depth HTTP security headers including Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options, and X-Frame-Options. Furthermore, sensitive web server signature banners and backend runtime details are disclosed in HTTP response headers.",
    impact: "Aids threat actors in fingerprinting backend architecture and exposes end-users to clickjacking and MIME-sniffing attacks.",
    technicalAnalysis: "Automated HTTP response probing on `https://www.emcochem.com/` verified that critical security headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options) are absent across web responses, while server identity headers disclose underlying infrastructure.",
    pocDescription: "Verify missing response headers via curl HEAD request against target.",
    reproduction: `curl -sI https://www.emcochem.com/ | grep -Ei "(Server|X-Powered-By|Content-Security|X-Frame|Strict-Transport)"`,
    remediation: "Configure the web server / reverse proxy to inject hardened OWASP security headers (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options) and disable public server signature banners.",
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

export const EMCOCHEM_ATTACK_CHAIN = {
  title: "Remote File Upload to Corporate Perimeter Access Chain",
  targetHost: "emcochem.com",
  steps: [
    {
      step: 1,
      name: "Public Asset Reconnaissance",
      target: "https://www.emcochem.com/contact/upload-inquiry",
      findingRef: "vuln-0004",
      action: "Autonomous endpoint discovery identified unrestricted multipart file upload in the inquiry interface.",
      impact: "Identified writable upload directory without server-side extension enforcement."
    },
    {
      step: 2,
      name: "MIME Filter Bypass & Payload Upload",
      target: "https://www.emcochem.com/contact/upload-inquiry",
      findingRef: "vuln-0004",
      action: "Uploaded double-extension payload (payload.php.pdf) with spoofed image/png Content-Type header.",
      impact: "Payload successfully written to web-accessible /uploads/inquiries/ directory."
    },
    {
      step: 3,
      name: "Cross-Site Scripting Pivoting",
      target: "https://www.emcochem.com/search",
      findingRef: "vuln-0002",
      action: "Injected script payload into product search parameter to demonstrate session token theft.",
      impact: "Arbitrary JavaScript execution in user browser session."
    },
    {
      step: 4,
      name: "Infrastructure Fingerprinting",
      target: "https://www.emcochem.com/",
      findingRef: "vuln-0001",
      action: "Extracted server signature banners and cryptographic suite information.",
      impact: "Confirmed absence of CSP and HSTS protections across the corporate perimeter."
    }
  ]
};

export const INITIAL_SCAN_HISTORY = [
  {
    id: "www-emcochem-com_406f",
    companyName: "Emcochem Inc",
    targetUrl: "https://www.emcochem.com/",
    timestamp: "2026-08-20 10:14:00 UTC",
    duration: "41 min 18 sec",
    durationSec: 2478,
    status: "Completed",
    createdBy: "admin",
    scannedBy: "admin",
    scannedByName: "Administrator",
    userRole: "Administrator",
    profile: "Autonomous Penetration Test (OWASP WSTG v4.2)",
    riskLevel: "HIGH",
    riskScore: 8.4,
    findingsCount: 4,
    highCount: 2,
    medCount: 2,
    lowCount: 0,
    tokens: 44210000,
    requests: 488,
    cost: 6.50,
    vulnerabilities: EMCOCHEM_VULNERABILITIES,
    attackChain: EMCOCHEM_ATTACK_CHAIN,
    outputFolderPath: "/root/emcochem-scan/strix_runs/www-emcochem-com_406f",
    metadata: {
      runId: "www-emcochem-com_406f",
      companyName: "Emcochem Inc",
      targetUrl: "https://www.emcochem.com/",
      totalFindings: 4,
      highCount: 2,
      medCount: 2,
      lowCount: 0,
      overallRiskLevel: "HIGH",
      overallRiskScore: 8.4,
      tokens: 44210000,
      requests: 488,
      cost: 6.50,
      durationSec: 2478,
      createdBy: "admin",
      scannedBy: "admin",
      scannedByName: "Administrator",
      remoteRunDir: "/root/emcochem-scan/strix_runs/www-emcochem-com_406f"
    }
  },
  {
    id: "www-smeco-coop_81f4",
    companyName: "Smeco Inc",
    targetUrl: "https://www.smeco.coop/",
    timestamp: "2026-08-19 10:51:24 UTC",
    duration: "38 min 12 sec",
    durationSec: 2292,
    status: "Completed",
    createdBy: "admin",
    scannedBy: "admin",
    scannedByName: "Administrator",
    userRole: "Administrator",
    profile: "Autonomous Penetration Test (OWASP WSTG v4.2)",
    riskLevel: "HIGH",
    riskScore: 8.2,
    findingsCount: 4,
    highCount: 1,
    medCount: 3,
    lowCount: 0,
    tokens: 48920000,
    requests: 524,
    cost: 7.19,
    vulnerabilities: SMECO_VULNERABILITIES,
    attackChain: SMECO_ATTACK_CHAIN,
    outputFolderPath: "/root/smeco-scan/strix_runs/www-smeco-coop_81f4",
    metadata: {
      runId: "www-smeco-coop_81f4",
      companyName: "Smeco Inc",
      targetUrl: "https://www.smeco.coop/",
      totalFindings: 4,
      highCount: 1,
      medCount: 3,
      lowCount: 0,
      overallRiskLevel: "HIGH",
      overallRiskScore: 8.2,
      tokens: 48920000,
      requests: 524,
      cost: 7.19,
      durationSec: 2292,
      createdBy: "admin",
      scannedBy: "admin",
      scannedByName: "Administrator",
      remoteRunDir: "/root/smeco-scan/strix_runs/www-smeco-coop_81f4"
    }
  },
  {
    id: "www-vontier-com_93f0",
    companyName: "Vontier Corporation",
    targetUrl: "https://www.vontier.com/",
    timestamp: "2026-08-11 09:59:52 UTC",
    duration: "42 min 36 sec",
    durationSec: 2556,
    status: "Completed",
    createdBy: "admin",
    scannedBy: "admin",
    scannedByName: "Administrator",
    userRole: "Administrator",
    profile: "Autonomous Penetration Test (OWASP WSTG v4.2)",
    riskLevel: "ELEVATED",
    riskScore: 6.8,
    findingsCount: 7,
    highCount: 1,
    medCount: 6,
    lowCount: 0,
    tokens: 36420000,
    requests: 404,
    cost: 5.35,
    vulnerabilities: VULNERABILITIES,
    outputFolderPath: "/root/vontier-scan/strix_runs/www-vontier-com_93f0",
    metadata: {
      ...SCAN_METADATA,
      runId: "www-vontier-com_93f0",
      companyName: "Vontier Corporation",
      targetUrl: "https://www.vontier.com/",
      totalFindings: 7,
      highCount: 1,
      medCount: 6,
      overallRiskLevel: "ELEVATED",
      overallRiskScore: 6.8,
      tokens: 36420000,
      requests: 404,
      cost: 5.35,
      durationSec: 2556,
      createdBy: "admin",
      scannedBy: "admin",
      scannedByName: "Administrator",
      remoteRunDir: "/root/vontier-scan/strix_runs/www-vontier-com_93f0"
    }
  }
];

export function getStoredScanHistory() {
  try {
    const stored = localStorage.getItem('sennovate_scan_history');
    let list = INITIAL_SCAN_HISTORY;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {}
    }

    // Ensure default initial baseline scans are available if list was empty
    const hasInitialScans = list.some(s => s.id === 'www-vontier-com_93f0' || s.id === 'www-smeco-coop_81f4');
    if (!hasInitialScans) {
      list = [...list, ...INITIAL_SCAN_HISTORY];
    }

    // Preserve each scan's distinct findings, tokens, cost, user attribution, and timestamps
    const enrichedList = list.map(scan => {
      let vulns = Array.isArray(scan.vulnerabilities) ? scan.vulnerabilities : null;
      if (!vulns) {
        if (scan.id === 'www-emcochem-com_406f') {
          vulns = EMCOCHEM_VULNERABILITIES;
        } else if (scan.id === 'www-smeco-coop_81f4') {
          vulns = SMECO_VULNERABILITIES;
        } else if (scan.id === 'www-vontier-com_93f0') {
          vulns = VULNERABILITIES;
        } else {
          vulns = [];
        }
      }

      const highCount = vulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length;
      const medCount = vulns.filter(v => v.severity === 'MEDIUM').length;
      const riskScore = vulns.length > 0 ? (vulns[0]?.cvss || 5.5) : (scan.riskScore || 4.0);
      const riskLevel = highCount > 0 ? 'HIGH' : (vulns.length > 0 ? 'ELEVATED' : (scan.riskLevel || 'LOW'));

      const tokens = typeof scan.tokens === 'number' ? scan.tokens : (typeof scan.metadata?.tokens === 'number' ? scan.metadata.tokens : 0);
      const requests = typeof scan.requests === 'number' ? scan.requests : (typeof scan.metadata?.requests === 'number' ? scan.metadata.requests : 0);
      const cost = typeof scan.cost === 'number' ? scan.cost : (typeof scan.metadata?.cost === 'number' ? scan.metadata.cost : 0);
      const durationSec = scan.durationSec || scan.metadata?.durationSec || 240;
      const duration = scan.duration || `${Math.max(1, Math.round(durationSec / 60))} min`;
      const createdBy = scan.createdBy || scan.scannedBy || 'admin';
      const scannedBy = scan.scannedBy || createdBy;
      const scannedByName = scan.scannedByName && !scan.scannedByName.includes('Alex Rivera') ? scan.scannedByName : (scannedBy === 'admin' ? 'Administrator' : (scannedBy.startsWith('user') ? 'User' : scannedBy));
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
        highCount,
        medCount,
        riskScore,
        riskLevel,
        metadata: {
          ...(scan.metadata || {}),
          createdBy,
          scannedBy,
          scannedByName,
          userRole,
          totalFindings: vulns.length,
          highCount,
          medCount,
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

  saveScanHistory(INITIAL_SCAN_HISTORY);
  return INITIAL_SCAN_HISTORY;
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
    console.warn('Note syncing scan history from server:', e.message);
  }
  return getStoredScanHistory();
}

