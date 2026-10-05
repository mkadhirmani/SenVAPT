import { getAuthHeaders } from './auth';

/**
 * Extracts and compiles all active styles from the current document
 * to guarantee that Tailwind CSS utilities, typography, and layout classes
 * are preserved in the standalone HTML and vector PDF.
 */
function extractDocumentStyles() {
  let cssText = '';

  // 1. Gather all <style> tag contents
  try {
    document.querySelectorAll('style').forEach(s => {
      if (s.textContent) {
        cssText += s.textContent + '\n';
      }
    });
  } catch (_) {}

  // 2. Gather rules from CSSStyleSheets safely
  try {
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.cssRules) {
          for (const rule of sheet.cssRules) {
            cssText += rule.cssText + '\n';
          }
        }
      } catch (_) {
        // Cross-origin stylesheet rules cannot be accessed, ignore safely
      }
    }
  } catch (_) {}

  return cssText;
}

/**
 * Clones the report container and inlines all images as base64 data URLs
 * so that headless Chrome or Word can render them without external asset dependencies.
 */
function cloneContainerWithInlinedImages(element) {
  const clone = element.cloneNode(true);
  const origImages = element.querySelectorAll('img');
  const cloneImages = clone.querySelectorAll('img');

  for (let i = 0; i < origImages.length; i++) {
    const orig = origImages[i];
    const cln = cloneImages[i];
    if (!orig || !cln) continue;

    try {
      if (orig.complete && orig.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = orig.naturalWidth;
        canvas.height = orig.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(orig, 0, 0);
          cln.src = canvas.toDataURL('image/png');
        }
      }
    } catch (e) {
      console.warn('Could not inline image to base64 data URL:', e.message);
    }
  }

  return clone;
}

/**
 * Builds a 100% self-contained, standalone HTML document formatted for A4 vector PDF
 * and direct editing in Microsoft Word, Google Docs, or modern web browsers.
 */
export function buildStandaloneReportHtml(elementId = 'vapt-pdf-report-root', title = 'Sennovate_VAPT_Security_Report') {
  const root = document.getElementById(elementId);
  if (!root) {
    throw new Error(`Report root container #${elementId} not found in DOM`);
  }

  const clonedRoot = cloneContainerWithInlinedImages(root);
  const activeStyles = extractDocumentStyles();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/_/g, ' ')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Captured Tailwind & Application Styles */
    ${activeStyles}

    /* Strict A4 Print & Vector Layout Formatting */
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 13px;
      line-height: 1.5;
    }
    .pdf-page {
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 auto !important;
      padding: 12mm 14mm 12mm 14mm !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      position: relative !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: hidden !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .pdf-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .pdf-card, .pdf-block {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    pre, code {
      font-family: 'JetBrains Mono', monospace !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }
    @media screen {
      body {
        background: #f1f5f9 !important;
        padding: 24px 0;
      }
      .pdf-page {
        margin: 0 auto 24px auto !important;
        box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1) !important;
        border-radius: 6px !important;
      }
    }
  </style>
</head>
<body>
  ${clonedRoot.innerHTML}
</body>
</html>`;
}

/**
 * High-Fidelity Native Vector Text PDF Exporter
 * 
 * Eliminates html2canvas raster screenshots. Instead, converts the report to a
 * pristine, selectable, searchable, editable vector PDF via server-side headless Chrome.
 * Text can be selected, searched (Ctrl+F), copied, and formatted.
 */
export async function exportReportToPdf(elementId = 'vapt-pdf-report-root', filename = 'Sennovate_VAPT_Security_Report.pdf') {
  try {
    const title = filename.replace(/\.pdf$/i, '');
    const htmlContent = buildStandaloneReportHtml(elementId, title);

    // Call server headless Chrome PDF generation route
    const res = await fetch('/api/reports/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        html: htmlContent,
        filename: filename
      })
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = filename;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
        return true;
      }
    }

    // If server generation returned an error, log details
    const errData = await res.json().catch(() => ({}));
    console.warn('Server vector PDF export note:', errData.error || res.statusText);
    
    // Fallback: Browser native print engine (which also produces 100% native vector text PDF)
    console.info('Invoking browser native print engine for vector text PDF...');
    window.print();
    return true;
  } catch (err) {
    console.error('Vector PDF export error, falling back to browser print:', err);
    window.print();
    return false;
  }
}

/**
 * Exports the complete report as an editable, standalone HTML document.
 * Can be opened directly in Microsoft Word, Google Docs, Apple Pages, or LibreOffice
 * so the user can easily format, edit, restyle, and customize every section.
 */
export function exportReportToHtml(elementId = 'vapt-pdf-report-root', filename = 'Sennovate_VAPT_Security_Report.html') {
  try {
    const title = filename.replace(/\.html$/i, '');
    const htmlContent = buildStandaloneReportHtml(elementId, title);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = filename.endsWith('.html') ? filename : `${filename}.html`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
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
