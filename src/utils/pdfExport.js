import { getAuthHeaders } from './auth';

/**
 * Report export helpers.
 *
 * The report is a self-contained HTML document produced by
 * utils/reportBuilder.js. It paginates itself into true A4 pages at load time,
 * so the server-side headless Chrome renderer, the in-app preview and the
 * browser print fallback all produce identical pages made of real, selectable
 * vector text (never screenshots of text).
 */

function waitForPagination(win, timeoutMs = 20000) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const tick = () => {
      try {
        if (win.document.documentElement.getAttribute('data-paginated')) return resolve(true);
      } catch (_) { return resolve(false); }
      if (Date.now() - t0 > timeoutMs) return resolve(false);
      setTimeout(tick, 150);
    };
    tick();
  });
}

/** Prints ONLY the report (never the dashboard) via an isolated A4 iframe. */
export function printIsolatedReport(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', top: '0', left: '-10000px', width: '230mm', height: '297mm', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  waitForPagination(iframe.contentWindow).then(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Isolated print failed:', err);
    } finally {
      setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 60000);
    }
  });
}

function triggerDownload(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Downloads the A4 report as a vector-text PDF rendered by headless Chrome on
 * the server. Falls back to the isolated print dialog ("Save as PDF").
 * @returns {'pdf'|'print'}
 */
export async function exportReportToPdf(htmlContent, filename = 'Sennovate_VAPT_Report.pdf') {
  try {
    const res = await fetch('/api/reports/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ html: htmlContent, filename })
    });
    if (res.ok && (res.headers.get('content-type') || '').includes('application/pdf')) {
      triggerDownload(await res.blob(), filename);
      return 'pdf';
    }
    const errData = await res.json().catch(() => ({}));
    console.warn('Server PDF generation unavailable:', errData.error || res.statusText);
  } catch (err) {
    console.warn('Server PDF generation error:', err);
  }
  printIsolatedReport(htmlContent);
  return 'print';
}

/** Downloads the self-contained report HTML (opens in any browser / Word). */
export function exportReportToHtml(htmlContent, filename = 'Sennovate_VAPT_Report.html') {
  try {
    triggerDownload(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), filename.endsWith('.html') ? filename : `${filename}.html`);
    return true;
  } catch (err) {
    console.error('HTML export error:', err);
    return false;
  }
}

/**
 * Generates a clean, structured Markdown / plain-text deliverable
 * of the report findings and roadmap that can be copied directly to clipboard.
 */
export function generateReportMarkdown({
  companyName = 'Target System',
  targetUrl = '',
  metadata = {},
  vulnerabilities = [],
  executiveSummary = ''
}) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [
    `# SENNOVATE AUTONOMOUS VAPT SECURITY REPORT`,
    `**Prepared For:** ${companyName}`,
    `**Target URL:** ${targetUrl}`,
    `**Assessment Type:** ${metadata.assessmentType || 'External Web Application & API Penetration Test'}`,
    `**Audit Date:** ${dateStr}`,
    `**Classification:** CONFIDENTIAL & PROPRIETARY`,
    ``,
    `---`,
    ``,
    `## 1. EXECUTIVE SUMMARY`,
    executiveSummary || 'Autonomous penetration testing completed across target attack surfaces with live exploit validation and vulnerability categorization.',
    ``,
    `---`,
    ``,
    `## 2. VULNERABILITY FINDINGS BREAKDOWN (${vulnerabilities.length} Confirmed Items)`,
    ``
  ];

  vulnerabilities.forEach((v, idx) => {
    lines.push(`### [${idx + 1}] ${v.title || 'Vulnerability Finding'}`);
    lines.push(`- **Severity:** ${(v.severity || 'Medium').toUpperCase()}`);
    lines.push(`- **CVSS Score:** ${v.cvss || 'N/A'}`);
    if (v.cve) lines.push(`- **CVE ID:** ${v.cve}`);
    if (v.location) lines.push(`- **Vulnerable Component:** ${v.location}`);
    if (v.description) {
      lines.push(``);
      lines.push(`**Description:**`);
      lines.push(v.description);
    }
    if (v.evidence || v.poc) {
      lines.push(``);
      lines.push(`**Proof of Concept / Technical Evidence:**`);
      lines.push('```');
      lines.push(v.evidence || v.poc);
      lines.push('```');
    }
    if (v.remediation) {
      lines.push(``);
      lines.push(`**Remediation & Mitigation Strategy:**`);
      lines.push(v.remediation);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  });

  lines.push(`Generated autonomously by Sennovate Autonomous VAPT Platform.`);
  return lines.join('\n');
}
