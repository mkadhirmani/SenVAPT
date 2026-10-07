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

export function printIsolatedReport(htmlContent) {
  try {
    const iframe = document.createElement('iframe');
    iframe.id = 'vapt-print-isolated-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Iframe print note, falling back to window print:', err);
        window.print();
      } finally {
        setTimeout(() => {
          try { iframe.remove(); } catch (_) {}
        }, 60000);
      }
    }, 600);
  } catch (e) {
    console.error('Error invoking isolated print iframe:', e);
    window.print();
  }
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

    /* Core Color Tokens & Report Typography */
    :root {
      --cyan: #0e7490;
      --cyan-600: #0891b2;
      --cyan-50: #ecfeff;
      --cyan-200: #a5f3fc;
      --slate-950: #020617;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-400: #94a3b8;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --red-900: #7f1d1d;
      --red-300: #fca5a5;
      --red-100: #fee2e2;
      --red-50: #fef2f2;
      --orange-950: #431407;
      --orange-300: #fdba74;
      --orange-100: #ffedd5;
      --orange-50: #fff7ed;
      --yellow-950: #422006;
      --yellow-300: #fde047;
      --yellow-100: #fef9c3;
      --yellow-50: #fefce8;
      --sky-900: #0c4a6e;
      --sky-200: #bae6fd;
      --sky-100: #e0f2fe;
      --sky-50: #f0f9ff;
      --rose-700: #be123c;
      --rose-200: #fecdd3;
      --rose-50: #fff1f2;
      --emerald-800: #065f46;
      --emerald-700: #047857;
      --emerald-200: #a7f3d0;
      --emerald-50: #ecfdf5;
      --amber-900: #78350f;
      --amber-700: #b45309;
      --amber-500: #f59e0b;
      --amber-200: #fde68a;
      --amber-50: #fffbeb;
    }

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
      font-size: 12px;
      line-height: 1.5;
    }
    .pdf-page, .report-page {
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      min-height: 297mm !important;
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
    .pdf-page:last-child, .report-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .pdf-card, .pdf-block, .box, .card, .codeblk, .checkgrid, .mtable, .fhead, .exposure, .risk-cards, .roadmap {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    pre, code, .mono {
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }
    @media screen {
      body {
        background: #f1f5f9 !important;
        padding: 24px 0;
      }
      .pdf-page, .report-page {
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
    
    // Fallback: Isolated iframe print (prints ONLY the report, NEVER the dashboard screen)
    console.info('Invoking isolated iframe print engine for vector text PDF...');
    printIsolatedReport(htmlContent);
    return true;
  } catch (err) {
    console.error('Vector PDF export error, falling back to isolated print:', err);
    try {
      const htmlContent = buildStandaloneReportHtml(elementId, filename.replace(/\.pdf$/i, ''));
      printIsolatedReport(htmlContent);
    } catch (_) {
      window.print();
    }
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
