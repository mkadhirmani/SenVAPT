export const SCAN_METADATA = {
  runId: "demo-target-estate_88a1",
  runName: "Enterprise Digital Assets Security Audit",
  targetUrl: "https://demo.example-security.com/",
  startTime: "2026-08-11T09:17:16.446772+00:00",
  endTime: "2026-08-11T09:59:52.762396+00:00",
  durationFormatted: "42 min 36 sec",
  status: "completed",
  authMode: "api_key",
  companyName: "Sennovate Inc.",
  companySubtitle: "Enterprise Cyber Defense & Autonomous VAPT Platform",
  companyWebsite: "https://www.sennovate.com",
  assessmentType: "External Black-Box Penetration Test (OWASP WSTG)",
  leadAuditor: "Sennovate Autonomous Security Engine (v2.4)",
  overallRiskLevel: "ELEVATED",
  overallRiskScore: 6.8, // on 10 scale
  totalFindings: 7,
  severitySummary: {
    critical: 0,
    high: 1,
    medium: 6,
    low: 0,
    info: 0
  },
  aiTelemetry: {
    totalRequests: 482,
    totalTokens: 42628021,
    cachedTokens: 23884480,
    reasoningTokens: 63581,
    subdomainsDiscovered: 8,
    apiEndpointsMapped: 138,
    simulatedExploitsExecuted: 29
  },
  subdomains: [
    { name: "www.example-security.com", ip: "192.0.2.22", status: "Active (CMS Portal, Edge WAF)", risk: "Medium" },
    { name: "portal.example-security.com", ip: "192.0.2.88", status: "Active (Express/Node.js, TLS Legacy)", risk: "High" },
    { name: "api.example-security.com", ip: "192.0.2.45", status: "Active (REST API v1, Cloud Gateway)", risk: "Medium" },
    { name: "auth.example-security.com", ip: "192.0.2.90", status: "Hardened (Enterprise IAM / SAML SSO)", risk: "Safe" },
    { name: "support.example-security.com", ip: "192.0.2.91", status: "Hardened (Helpdesk Portal)", risk: "Safe" },
    { name: "itsupport.example-security.com", ip: "192.0.2.92", status: "Hardened (SSO Enabled)", risk: "Safe" },
    { name: "dev.example-security.com", ip: "192.0.2.104", status: "Protected (HTTP Basic Auth Enforced)", risk: "Safe" },
    { name: "test.example-security.com", ip: "192.0.2.105", status: "Protected (HTTP Basic Auth Enforced)", risk: "Safe" }
  ]
};

export const VULNERABILITIES = [
  {
    id: "vuln-0004",
    title: "DOM XSS via postMessage Without Origin Validation in login.html",
    severity: "HIGH",
    cvss: 8.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:L",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "High (H)",
      integrity: "High (H)",
      availability: "Low (L)"
    },
    cwe: "CWE-79",
    cweName: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
    target: "https://portal.example-security.com/",
    endpoint: "/login.html",
    method: "GET",
    timestamp: "2026-08-11 09:56:36 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Portal Validation & Autonomous Exploitation Agent",
    description: "The login.html page at portal.example-security.com registers a message event listener on window that accepts postMessage events from any origin without validation. The e.data.msg property is injected directly into the DOM via innerHTML, enabling arbitrary HTML/JavaScript execution in the context of the vulnerable origin.",
    impact: "An attacker can execute arbitrary JavaScript in the context of portal.example-security.com, leading to cookie theft, session hijacking, phishing overlays, redirection to malicious sites, or defacement. This can be chained with the open redirect on the same page to create a fully automated exploit requiring only a single victim click.",
    technicalAnalysis: `The login.html page contains a message event listener that processes cross-origin messages without validating the sender's origin. The listener extracts e.data.msg and sets it as the innerHTML of the page header element (document.getElementById('header').innerHTML = "<h1>"+e.data.msg+"</h1>"). This is a classic DOM-based XSS via postMessage.

The relevant code path:
1. A message event is received on the window object
2. The origin check is commented out — no validation occurs
3. e.data.msg is concatenated into an HTML string and assigned to innerHTML
4. Any HTML tags or JavaScript event handlers in msg are rendered and executed

Combined with the open redirect vulnerability (where window.open(url) is called with an attacker-controlled URL from the query string), an attacker can create a fully automated exploit.`,
    pocDescription: `Validation:
1. Navigate to https://portal.example-security.com/login.html
2. Open browser console and dispatch a MessageEvent:
   window.dispatchEvent(new MessageEvent('message', { data: {msg: '<img src=x onerror=alert(document.domain)>', browser: 'chrome'} }));
3. Observe injected <img> tag rendering in the header with onerror executing.

Full Chained 1-Click Exploitation:
1. Victim clicks: https://portal.example-security.com/login.html?url=https://attacker.com/exploit
2. Vulnerable page opens attacker.com/exploit via window.open()
3. Attacker page dispatches postMessage back to window.opener with malicious payload
4. Vulnerable page injects payload via innerHTML, executing script in domain context.`,
    pocScripts: {
      python: `import asyncio
from playwright.async_api import async_playwright

async def poc():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://portal.example-security.com/login.html")
        
        # Inject synthetic malicious postMessage
        await page.evaluate("""
            window.dispatchEvent(new MessageEvent('message', {
                data: { msg: '<img src=x onerror="window.__xss_fired=true">' },
                origin: 'https://attacker-domain.com'
            }));
        """)
        
        result = await page.evaluate("window.__xss_fired")
        print(f"[+] DOM XSS Status: {result}")
        await browser.close()

asyncio.run(poc())`,
      bash: `curl -s -X GET "https://portal.example-security.com/login.html" | grep -i "addEventListener('message'"`,
      javascript: `// Execute directly in browser console on https://portal.example-security.com/login.html
window.dispatchEvent(new MessageEvent('message', {
  data: { msg: '<img src=x onerror="alert(document.domain)">' },
  origin: 'https://attacker.com'
}));`
    },
    evidence: `Observed vulnerable JavaScript snippet on portal.example-security.com/login.html:

window.addEventListener('message', (e) => {
    // Origin check disabled in testing
    // if (e.origin !== "https://portal.example-security.com") return;
    
    if (e.data.msg) {
        document.getElementById('header').innerHTML = "<h1>" + e.data.msg + "</h1>";
    }
});`,
    remediation: "Enforce strict origin validation in the message event listener (e.origin === 'https://portal.example-security.com') and replace innerHTML with textContent or a sanitized DOM sanitizer like DOMPurify.",
    remediationSteps: [
      "Validate the e.origin property against a strict allowlist of trusted domains in the message event handler.",
      "Replace document.getElementById('header').innerHTML with element.textContent to prevent HTML rendering.",
      "If rich HTML rendering is necessary, sanitize all input using DOMPurify before inserting into the DOM.",
      "Remove automated window.open(url) calls triggered by unvalidated URL query parameters."
    ],
    assumptions: "Exploitation requires user interaction (clicking a link or visiting an attacker-controlled webpage)."
  },
  {
    id: "vuln-0002",
    title: "Publicly Accessible CMS Installation Script at /core/install.php",
    severity: "MEDIUM",
    cvss: 5.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "None (N)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-200",
    cweName: "Exposure of Sensitive Information to an Unauthorized Actor",
    target: "https://www.example-security.com/core/install.php",
    endpoint: "/core/install.php",
    method: "GET",
    timestamp: "2026-08-11 09:23:45 UTC",
    fixEffort: "Low",
    findingClass: "static",
    agentId: "a1029384",
    agentName: "Recon & Surface Mapping Agent",
    description: "The core installation endpoint is publicly accessible without authentication. While already installed, the endpoint reveals precise core CMS versions and patch levels in static CSS assets and headers.",
    impact: "Unauthenticated attackers can precisely fingerprint the exact CMS version running on production, streamlining exploit selection for version-specific CVEs.",
    technicalAnalysis: `Requesting /core/install.php returns HTTP 200 with an 'Already Installed' message. The HTML source links stylesheets containing version parameters (e.g. ?v=10.6.12), leaking the CMS version.`,
    pocDescription: `1. Send a GET request to https://www.example-security.com/core/install.php
2. Inspect the HTTP status (200 OK) and extract version tags from CSS/JS assets.`,
    pocScripts: {
      bash: `curl -s -I "https://www.example-security.com/core/install.php" | head -n 5`,
      python: `import requests
r = requests.get('https://www.example-security.com/core/install.php')
print(f"Status: {r.status_code}, Length: {len(r.text)}")`
    },
    evidence: `HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8

<link rel="stylesheet" href="/core/assets/vendor/normalize-css/normalize.css?v=10.6.12" />`,
    remediation: "Block public access to /core/install.php and documentation files at the web server / reverse proxy layer.",
    remediationSteps: [
      "Configure web server edge rules to return HTTP 403 Forbidden for all requests to /core/install.php.",
      "Remove or restrict access to CHANGELOG.txt, INSTALL.txt, and README files in web root."
    ],
    assumptions: "Public network access to the primary web domain."
  },
  {
    id: "vuln-0003",
    title: "Publicly Accessible REST API Documentation at /api/rest/v1/Help",
    severity: "MEDIUM",
    cvss: 5.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "None (N)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-200",
    cweName: "Exposure of Sensitive Information to an Unauthorized Actor",
    target: "https://api.example-security.com/",
    endpoint: "/api/rest/v1/Help",
    method: "GET",
    timestamp: "2026-08-11 09:28:12 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "b8392019",
    agentName: "API Security & Endpoint Enumeration Agent",
    description: "The API instance exposes its full REST API v1 documentation at /api/rest/v1/Help without authentication, documenting 138 API endpoints across 33 controllers, parameter requirements, and models.",
    impact: "Provides potential adversaries with a complete roadmap of all internal API endpoints, parameters, models, and administrative controllers.",
    technicalAnalysis: `The application serves auto-generated API Help Pages at /api/rest/v1/Help enumerating controllers and models without authentication.`,
    pocDescription: `1. Send GET request to https://api.example-security.com/api/rest/v1/Help
2. Observe HTTP 200 OK returning 138 documented endpoints.`,
    pocScripts: {
      bash: `curl -s -o /dev/null -w "%{http_code} (%{size_download} bytes)" "https://api.example-security.com/api/rest/v1/Help"`,
      python: `import requests
r = requests.get("https://api.example-security.com/api/rest/v1/Help")
print(f"Help page loaded: {len(r.text)} bytes, Status: {r.status_code}")`
    },
    evidence: `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>REST API Help Page</title></head>
<body><h1>API Reference Documentation (138 Endpoints)</h1></body>
</html>`,
    remediation: "Restrict access to /api/rest/v1/Help by requiring authentication and authorization.",
    remediationSteps: [
      "Restrict access to /api/rest/v1/Help to authenticated administrators.",
      "Disable auto-generated API help page generation in production configurations."
    ],
    assumptions: "None — public endpoint."
  },
  {
    id: "vuln-0005",
    title: "Client-Side Open Redirect via window.open() in login.html",
    severity: "MEDIUM",
    cvss: 6.1,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Changed (C)",
      confidentiality: "Low (L)",
      integrity: "Low (L)",
      availability: "None (N)"
    },
    cwe: "CWE-601",
    cweName: "URL Redirection to Untrusted Site ('Open Redirect')",
    target: "https://portal.example-security.com/",
    endpoint: "/login.html?url=...",
    method: "GET",
    timestamp: "2026-08-11 09:38:22 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Portal Validation & Autonomous Exploitation Agent",
    description: "The /login.html page parses the URL query string for a redirect target and opens it in a new window via window.open() without validation of the target URL scheme, host, or path.",
    impact: "An attacker can craft a phishing link on the trusted domain that redirects victims to external sites, facilitating credential harvesting.",
    technicalAnalysis: `The JavaScript on login.html extracts the 'url' query parameter and calls window.open(url) on page load without validation.`,
    pocDescription: `1. Open browser to: https://portal.example-security.com/login.html?url=https://example.com
2. Observe new window opening to example.com.`,
    pocScripts: {
      bash: `curl -s "https://portal.example-security.com/login.html" | grep -i "window.open"`,
      python: `target = "https://portal.example-security.com/login.html?url=https://attacker-phishing.com"
print(f"Phishing Link: {target}")`
    },
    evidence: `var url = window.location.search.substring(1).split('&').find(p => p.startsWith('url='));
if (url) {
    window.open(decodeURIComponent(url.split('=')[1]));
}`,
    remediation: "Validate all redirect targets against a strict allowlist of authorized relative paths or trusted company domain names.",
    remediationSteps: [
      "Validate redirect URLs against a strict relative-path pattern.",
      "Verify hostname matches authorized domain allowlist before calling window.open()."
    ],
    assumptions: "Victim must click an attacker-supplied link."
  },
  {
    id: "vuln-0007",
    title: "Permissive Cross-Origin Resource Sharing (CORS) Policy",
    severity: "MEDIUM",
    cvss: 5.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "None (N)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-942",
    cweName: "Permissive Cross-Domain Policy with Untrusted Domains",
    target: "https://portal.example-security.com/",
    endpoint: "/*",
    method: "OPTIONS / GET",
    timestamp: "2026-08-11 09:35:10 UTC",
    fixEffort: "Low",
    findingClass: "static",
    agentId: "d4920184",
    agentName: "HTTP Protocol & Header Auditor",
    description: "HTTP responses include the Access-Control-Allow-Origin: * header, allowing any external origin to read application responses.",
    impact: "Allows arbitrary external sites to make cross-origin requests and read non-authenticated response payloads.",
    technicalAnalysis: `The application attaches Access-Control-Allow-Origin: * to all responses and OPTIONS preflight requests.`,
    pocDescription: `Send OPTIONS preflight request with Origin: https://evil.com and verify response header.`,
    pocScripts: {
      bash: `curl -s -H "Origin: https://evil.com" -X OPTIONS https://portal.example-security.com/ -I | grep -i access-control-allow-origin`
    },
    evidence: `HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type`,
    remediation: "Restrict CORS to explicit trusted origins and remove wildcard allow policies.",
    remediationSteps: [
      "Replace Access-Control-Allow-Origin: * with specific authorized domains.",
      "Remove permissive CORS headers from static asset endpoints."
    ],
    assumptions: "None."
  },
  {
    id: "vuln-0001",
    title: "Weak HSTS Configuration (Missing includeSubDomains / preload)",
    severity: "LOW",
    cvss: 3.7,
    cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "High (H)",
      privileges_required: "None (N)",
      user_interaction: "None (N)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-319",
    cweName: "Cleartext Transmission of Sensitive Information",
    target: "https://www.example-security.com/",
    endpoint: "www.example-security.com",
    method: "GET",
    timestamp: "2026-08-11 09:19:02 UTC",
    fixEffort: "Low",
    findingClass: "static",
    agentId: "d4920184",
    agentName: "HTTP Protocol & Header Auditor",
    description: "The main portal sets HSTS max-age to 300 seconds without includeSubDomains or preload directives.",
    impact: "Subdomains without their own HSTS headers remain susceptible to SSL stripping attacks on insecure networks.",
    technicalAnalysis: `The Strict-Transport-Security header specifies max-age=300 (5 minutes), failing to protect subdomains or qualify for browser HSTS preload lists.`,
    pocDescription: `curl -s -I https://www.example-security.com/ | grep -i strict-transport-security`,
    pocScripts: {
      bash: `curl -s -I https://www.example-security.com/ | grep -i strict-transport-security`
    },
    evidence: `Strict-Transport-Security: max-age=300`,
    remediation: "Upgrade HSTS header to max-age=31536000 with includeSubDomains and preload.",
    remediationSteps: [
      "Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload."
    ],
    assumptions: "Adversary position on local network / MITM position."
  },
  {
    id: "vuln-0006",
    title: "Expired TLS Certificate on Legacy Portal Subdomain",
    severity: "MEDIUM",
    cvss: 6.5,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "High (H)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-295",
    cweName: "Improper Certificate Validation",
    target: "https://portal.example-security.com/",
    endpoint: "portal.example-security.com:443",
    method: "TLS Handshake",
    timestamp: "2026-08-11 09:32:44 UTC",
    fixEffort: "Low",
    findingClass: "static",
    agentId: "d4920184",
    agentName: "HTTP Protocol & Header Auditor",
    description: "The legacy portal subdomain serves an expired TLS certificate, triggering browser warnings and leaving users open to MITM inspection if bypassed.",
    impact: "Users experience severe browser security warnings (ERR_CERT_DATE_INVALID). Users bypassing the warning are vulnerable to MITM eavesdropping.",
    technicalAnalysis: `The TLS certificate has expired. Indicates an unmaintained or abandoned subdomain instance.`,
    pocDescription: `echo | openssl s_client -servername portal.example-security.com -connect portal.example-security.com:443 2>/dev/null | openssl x509 -noout -dates`,
    pocScripts: {
      bash: `echo | openssl s_client -servername portal.example-security.com -connect portal.example-security.com:443 2>/dev/null | openssl x509 -noout -dates`
    },
    evidence: `Certificate Details:
notBefore=Jul 15 00:00:00 2022 GMT
notAfter=Jul 18 23:59:59 2023 GMT
CN=portal.example-security.com`,
    remediationSteps: [
      "Obtain and install a valid TLS certificate from a trusted Certificate Authority.",
      "Configure automated certificate renewal (e.g. Let's Encrypt / Certbot or Managed Certificates).",
      "Decommission the subdomain if the legacy application is no longer in active use."
    ],
    assumptions: "Users must bypass browser TLS warning dialogs to establish connection."
  }
];

export const ATTACK_CHAIN = {
  title: "1-Click Account Takeover & DOM XSS Exploitation Chain",
  targetAsset: "portal.example-security.com",
  severity: "HIGH",
  cvss: 8.3,
  steps: [
    {
      stepNumber: 1,
      title: "Phishing Link Delivery",
      description: "Attacker crafts a link on trusted domain: https://portal.example-security.com/login.html?url=https://attacker.com/exploit.html and sends it to victim.",
      findingRef: "vuln-0005",
      type: "Open Redirect"
    },
    {
      stepNumber: 2,
      title: "Client-Side Tab Open",
      description: "Vulnerable login.html executes window.open(url) on page load, opening attacker.com/exploit.html in a child tab with an active window.opener reference.",
      findingRef: "vuln-0005",
      type: "Execution"
    },
    {
      stepNumber: 3,
      title: "Cross-Origin postMessage Dispatch",
      description: "Attacker's page executes window.opener.postMessage({msg: '<img src=x onerror=...fetch(...)>'}, '*') back to the parent window.",
      findingRef: "vuln-0004",
      type: "Communication"
    },
    {
      stepNumber: 4,
      title: "Unvalidated DOM Injection",
      description: "Vulnerable login.html receives postMessage without origin check and inserts payload directly into document.getElementById('header').innerHTML.",
      findingRef: "vuln-0004",
      type: "DOM XSS"
    },
    {
      stepNumber: 5,
      title: "Credential & Session Exfiltration",
      description: "JavaScript executes inside the trusted origin context, exfiltrating session tokens, cookies, and local storage to attacker C2 server.",
      findingRef: "vuln-0004",
      type: "Impact"
    }
  ]
};

export const POSITIVE_CONTROLS = [
  "Main web portal (www.example-security.com) is hardened with CSRF protection, secure session handling, and robust rate limiting.",
  "No SQL Injection, Server-Side Template Injection, or IDOR vulnerabilities detected on the primary domain.",
  "Identity & Helpdesk services are securely federated with Single Sign-On and Multi-Factor Authentication.",
  "Development and Staging environments strictly enforce HTTP Basic Authentication against brute force.",
  "Secure file sharing infrastructure enforces strong security headers (HSTS, strict CSP, X-Frame-Options: DENY).",
  "Administrative services properly configured with role-based access control."
];

export const EXECUTIVE_RECOMMENDATIONS = [
  {
    priority: "CRITICAL",
    timeframe: "Immediate (0-48 hrs)",
    title: "Remediate DOM XSS & Open Redirect on portal.example-security.com",
    details: "Enforce origin validation in postMessage listener and replace innerHTML with textContent. Remove automated window.open() calls on login.html."
  },
  {
    priority: "HIGH",
    timeframe: "Immediate (0-48 hrs)",
    title: "Renew TLS Certificate & Review Portal Subdomain Lifecycle",
    details: "Replace the expired TLS certificate or completely decommission the legacy application if no longer required."
  },
  {
    priority: "MEDIUM",
    timeframe: "Short-Term (1-2 weeks)",
    title: "Restrict Administrative Endpoints and Documentation",
    details: "Block public access to installation scripts and version documentation via edge rules or WAF."
  },
  {
    priority: "MEDIUM",
    timeframe: "Short-Term (1-2 weeks)",
    title: "Gate REST API Help Documentation",
    details: "Enforce authentication on /api/rest/v1/Help and strip internal server leak headers in production reverse proxy."
  },
  {
    priority: "LOW",
    timeframe: "Medium-Term (30 days)",
    title: "HSTS & Defense-in-Depth Security Headers",
    details: "Upgrade HSTS max-age to 31536000 with includeSubDomains and preload, and implement Content-Security-Policy (CSP) across main estate."
  }
];

export const SIMULATION_LOGS = [
  "[00:01] [INIT] Sennovate Autonomous VAPT Engine initialized for target: https://demo.example-security.com/",
  "[00:03] [RECON] Launching Subfinder & Certificate Transparency stream...",
  "[00:05] [DISCOVERY] Identified 8 live subdomains: www, portal, api, auth, support, itsupport, dev, test",
  "[00:09] [PROBE] Port scanning top 1000 ports on discovered assets via Naabu engine...",
  "[00:14] [CRAWL] Headless Chrome (Agent-Browser) crawler spawned for deep DOM analysis...",
  "[00:19] [ANALYZE] Fingerprinted main target: Edge Gateway and Application Services",
  "[00:23] [ALERT] Detected public exposure of administrative script (vuln-0002)",
  "[00:28] [CRAWL] Crawled 138 API endpoints on api.example-security.com/api/rest/v1/Help (vuln-0003)",
  "[00:32] [PROBE] Investigating portal.example-security.com — TLS Certificate expired (vuln-0006)",
  "[00:35] [PROBE] CORS preflight scan returned Access-Control-Allow-Origin: * (vuln-0007)",
  "[00:38] [FUZZ] Discovered unvalidated window.open(url) parameter in /login.html (vuln-0005)",
  "[00:41] [EXPLOIT] Dispatched synthetic MessageEvent to postMessage listener on login.html...",
  "[00:44] [CRITICAL] Confirmed DOM XSS execution via innerHTML without origin validation (vuln-0004 - CVSS 8.3)",
  "[00:48] [RAG] Indexing scan artifacts into Sennovate Vector Knowledge Graph...",
  "[00:52] [SYNTHESIS] RAG synthesis generated executive threat brief and remediation roadmap.",
  "[00:55] [COMPLETE] VAPT scan finalized. 7 confirmed vulnerabilities loaded. Professional report ready."
];
