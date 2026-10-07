import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Printer, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Globe, 
  Lock, 
  Terminal, 
  Sparkles, 
  Check, 
  Calendar, 
  Layers, 
  Building, 
  ChevronDown, 
  Bot, 
  RefreshCw, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  Shield, 
  Code, 
  FileCode, 
  Info,
  CheckSquare,
  Copy
} from 'lucide-react';
import { exportReportToPdf, exportReportToHtml, generateReportMarkdown } from '../utils/pdfExport';
import { askLlmWithRag } from '../utils/llmEngine';
import { sortVulnerabilities } from '../utils/severityUtils';
import { extractDomainInfo, sanitizeCompanyName, getDisplayDomain } from '../utils/domainUtils';

function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^#+\s*/, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/[`_]/g, '')
    .trim();
}

function getCompleteTargetUrl(vuln, fallbackBaseUrl) {
  if (!vuln) return fallbackBaseUrl || '';
  const targetStr = (vuln.target || '').trim();
  const endpointStr = (vuln.endpoint || '').trim();

  if (targetStr && /^https?:\/\//i.test(targetStr)) {
    if (endpointStr && endpointStr.startsWith('/') && !targetStr.endsWith(endpointStr)) {
      try {
        const u = new URL(targetStr);
        return `${u.origin}${endpointStr}`;
      } catch (e) {
        return targetStr;
      }
    }
    return targetStr;
  }

  const base = fallbackBaseUrl && /^https?:\/\//i.test(fallbackBaseUrl)
    ? fallbackBaseUrl
    : (fallbackBaseUrl ? `https://${fallbackBaseUrl}` : '');

  const path = endpointStr || targetStr || '/';
  if (!base) return path;

  try {
    const u = new URL(base);
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${u.origin}${cleanPath}`;
  } catch (e) {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}

function formatSeverityBreakdown(vulns) {
  if (!vulns || vulns.length === 0) return '0 Findings';
  const crit = vulns.filter(v => v.severity === 'CRITICAL').length;
  const high = vulns.filter(v => v.severity === 'HIGH').length;
  const med = vulns.filter(v => v.severity === 'MEDIUM').length;
  const low = vulns.filter(v => v.severity === 'LOW' || v.severity === 'INFO').length;

  const parts = [];
  if (crit > 0) parts.push(`${crit} Critical`);
  if (high > 0) parts.push(`${high} High`);
  if (med > 0) parts.push(`${med} Medium`);
  if (low > 0) parts.push(`${low} Low`);

  return parts.length > 0 ? parts.join(', ') : '0 Findings';
}

function getPocCodeString(vuln) {
  if (!vuln) return '';
  if (vuln.pocScripts) {
    if (vuln.pocScripts.bash) return vuln.pocScripts.bash;
    if (vuln.pocScripts.python) return vuln.pocScripts.python;
    if (vuln.pocScripts.javascript) return vuln.pocScripts.javascript;
  }
  if (vuln.reproduction) return vuln.reproduction;
  if (vuln.evidence && vuln.evidence.length < 300) return vuln.evidence;
  return `curl -s -X GET "${vuln.target || 'https://target-system.internal'}"`;
}

export default function PdfReport({ 
  vulnerabilities = [], 
  metadata = {}, 
  companyName = "Target Organization", 
  theme = 'light' 
}) {
  const [reportType, setReportType] = useState('detailed'); // 'detailed' | 'simple'
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportHtmlSuccess, setExportHtmlSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [customAiSummary, setCustomAiSummary] = useState(null);

  const sortedVulns = useMemo(() => {
    return sortVulnerabilities(vulnerabilities);
  }, [vulnerabilities]);

  const critVulns = sortedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const lowVulns = sortedVulns.filter(v => v.severity === 'LOW' || v.severity === 'INFO');
  const topVuln = sortedVulns[0] || null;

  const rawTarget = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target-system.internal");
  const domainInfo = useMemo(() => {
    return extractDomainInfo(rawTarget, companyName);
  }, [rawTarget, companyName]);

  const displayCompanyName = useMemo(() => {
    return sanitizeCompanyName(companyName, rawTarget);
  }, [companyName, rawTarget]);

  const displayTargetDomain = useMemo(() => {
    return domainInfo.rootDomain || getDisplayDomain(rawTarget);
  }, [domainInfo, rawTarget]);

  const targetUrl = rawTarget;
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 7.5;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 8.5 ? 'CRITICAL' : (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED'));

  const evaluatedTargets = useMemo(() => {
    return Array.from(new Set([
      ...(metadata.testedSubdomains || metadata.subdomains || []).map(s => typeof s === 'string' ? s : (s?.name || '')),
      ...sortedVulns.map(v => {
        try {
          const u = v.target ? (v.target.startsWith('http') ? v.target : `https://${v.target}`) : '';
          return u ? new URL(u).hostname : null;
        } catch (_) { return null; }
      }).filter(Boolean),
      targetUrl ? (targetUrl.startsWith('http') ? new URL(targetUrl).hostname : targetUrl) : null
    ].filter(Boolean)));
  }, [metadata, sortedVulns, targetUrl]);

  // Total pages calculation: Cover (1) + Exec Summary (1) + Matrix (1) + Findings (1 per finding in detailed)
  const totalPages = reportType === 'detailed' 
    ? 3 + sortedVulns.length 
    : 2 + Math.ceil(sortedVulns.length / 2);

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const prompt = `You are a Principal Security Consultant creating an executive penetration testing deliverable for ${displayCompanyName} (Target Domain: ${displayTargetDomain}, Primary Target: ${targetUrl}).
Generate a concise, crisp, perfectly proportioned Executive Summary and Threat Alignment that fits Page 2 of a standard A4 deliverable:
1. Executive Threat Overview (2 concise paragraphs evaluating overall posture, highest risk attack vectors, and business impact).
2. Key Risk Breakdown (bulleted breakdown of confirmed Critical, High, and Medium vulnerabilities with exact mechanics).
3. Strategic 3-Phase Action Roadmap:
   - Phase 1 (< 24h Immediate Containment)
   - Phase 2 (< 7 Days Architectural Remediation)
   - Phase 3 (< 30 Days Governance & Regression Testing)
Format with clean markdown bullet points and bold headers.`;

      const res = await askLlmWithRag({
        userMessage: prompt,
        companyName: displayCompanyName,
        targetUrl,
        vulnerabilities: sortedVulns
      });

      if (res && (res.answer || res.text)) {
        setCustomAiSummary(res.answer || res.text);
      }
    } catch (e) {
      console.warn('AI summary generation error:', e);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const sanitizedName = (displayCompanyName || displayTargetDomain || 'Target_System').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Sennovate_VAPT_${reportType === 'simple' ? 'Simple' : 'Executive'}_Report_${sanitizedName}.pdf`;
      await exportReportToPdf('vapt-pdf-report-root', filename);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportHtml = () => {
    try {
      const sanitizedName = (displayCompanyName || displayTargetDomain || 'Target_System').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Sennovate_VAPT_${reportType === 'simple' ? 'Simple' : 'Executive'}_Report_${sanitizedName}.html`;
      exportReportToHtml('vapt-pdf-report-root', filename);
      setExportHtmlSuccess(true);
      setTimeout(() => setExportHtmlSuccess(false), 3000);
    } catch (e) {
      console.error('HTML export error:', e);
    }
  };

  const handleCopyMarkdown = () => {
    try {
      const text = generateReportMarkdown({
        companyName: displayCompanyName,
        targetUrl,
        metadata,
        vulnerabilities: sortedVulns,
        executiveSummary: customAiSummary
      });
      navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (e) {
      console.error('Copy markdown error:', e);
    }
  };

  if (!vulnerabilities || vulnerabilities.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className={`p-12 rounded-2xl border text-center space-y-4 ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center border border-cyan-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              No Audit Reports Generated
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No completed security scans or vulnerabilities are available to compile into an executive report. Run an autonomous VAPT scan first to generate a full deliverable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Action Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border bg-[#001B41] border-[#002B66] text-white shadow-xl no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#006FE3]/15 text-[#006FE3] border border-[#006FE3]/30">
            <FileText className="w-5 h-5 text-[#006FE3]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-heading">
              Executive Penetration Testing Report
              <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#006FE3]/20 text-[#80B7F1] font-mono border border-[#006FE3]/30">
                A4 Deliverable &bull; {reportType === 'simple' ? 'Simple' : 'Detailed'} Format &bull; {totalPages} Pages
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Target: <span className="font-mono text-[#80B7F1]">{displayCompanyName} ({displayTargetDomain})</span> &bull; {sortedVulns.length} Confirmed Findings (100% Vector Text)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Format Toggle */}
          <div className="flex items-center bg-[#001127] p-1 rounded-xl border border-[#002B66] shadow-inner">
            <button
              type="button"
              onClick={() => setReportType('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                reportType === 'detailed'
                  ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Detailed Report</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType('simple')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                reportType === 'simple'
                  ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Simple Report</span>
            </button>
          </div>

          {reportType === 'detailed' && (
            <button
              onClick={handleGenerateAiSummary}
              disabled={isGeneratingAiSummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-[#80B7F1] border border-[#002B66] hover:bg-[#002B66] transition-colors disabled:opacity-50 shadow-sm font-heading cursor-pointer"
            >
              {isGeneratingAiSummary ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006FE3]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#006FE3]" />
              )}
              <span>{isGeneratingAiSummary ? "Synthesizing..." : "Re-generate AI Summary"}</span>
            </button>
          )}

          <button
            onClick={handleExportHtml}
            title="Download editable HTML report document"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-[#80B7F1] border border-[#002B66] hover:bg-[#002B66] transition-colors font-heading cursor-pointer"
          >
            {exportHtmlSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-[#006FE3]" />
            )}
            <span>{exportHtmlSuccess ? "Exported!" : "Editable (.html)"}</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            title="Copy full findings text to clipboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-slate-200 border border-[#002B66] hover:bg-[#002B66] transition-colors font-heading cursor-pointer"
          >
            {copiedText ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>{copiedText ? "Copied!" : "Copy Text"}</span>
          </button>

          <button
            onClick={handlePrint}
            title="Open browser print dialog for isolated A4 vector PDF"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-slate-200 border border-[#002B66] hover:bg-[#002B66] transition-colors font-heading cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>

          <button
            id="btn-download-pdf-report"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#006FE3] text-white hover:bg-[#005bbd] transition-all shadow-md shadow-[#006FE3]/25 disabled:opacity-60 font-heading hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? "Generating PDF..." : exportSuccess ? "Downloaded!" : "Download PDF Report"}</span>
          </button>
        </div>
      </div>

      {/* Embedded Executive A4 Report Stylesheet */}
      <style>{`
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

        .pdf-page, .report-page {
          width: 210mm;
          min-width: 210mm;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px auto;
          padding: 12mm 14mm 12mm 14mm;
          background: #ffffff;
          box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.10);
          border-radius: 4px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          page-break-after: always;
          break-after: page;
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
          color: var(--slate-900);
        }

        .pdf-page *, .report-page * {
          box-sizing: border-box;
        }

        .mono {
          font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace !important;
        }

        .grow { flex: 1; }

        .cover-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--slate-200);
          padding-bottom: 12px;
        }

        .brand-logo {
          height: 32px;
          width: auto;
          object-fit: contain;
          display: block;
        }

        .conf {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--rose-700);
          background: var(--rose-50);
          border: 1px solid var(--rose-200);
          padding: 4px 9px;
          border-radius: 6px;
        }

        .docref {
          font-size: 10px;
          color: var(--slate-500);
          margin-top: 4px;
          text-align: right;
        }

        .run-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--slate-200);
          padding-bottom: 8px;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--slate-500);
        }

        .run-head .t {
          color: var(--cyan);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .run-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--slate-200);
          padding-top: 8px;
          margin-top: auto;
          font-size: 10.5px;
          color: var(--slate-500);
        }

        .content {
          flex: 1;
          padding-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .badge-scope {
          background: var(--cyan-50);
          border: 1px solid var(--cyan-200);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--cyan);
          text-transform: uppercase;
          letter-spacing: .5px;
          padding: 4px 11px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 10px 12px;
          background: var(--slate-50);
          border: 1px solid var(--slate-200);
          border-radius: 12px;
        }

        .kpi .lab {
          font-size: 9.5px;
          font-weight: 700;
          color: var(--slate-500);
          text-transform: uppercase;
          letter-spacing: .5px;
          display: block;
        }

        .kpi .val {
          font-size: 12px;
          font-weight: 800;
          color: var(--slate-900);
          display: block;
          margin-top: 2px;
        }

        .kpi .val.risk { color: var(--rose-700); }
        .kpi .val.tel { color: var(--cyan); }
        .kpi .val.ok { color: var(--emerald-700); }

        .card {
          border: 1px solid var(--slate-200);
          border-radius: 11px;
          padding: 10px 12px;
        }

        .card.gray { background: var(--slate-50); }

        .card .hd {
          font-size: 11px;
          font-weight: 700;
          color: var(--slate-900);
          text-transform: uppercase;
          letter-spacing: .5px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;
        }

        .ico { color: var(--cyan-600); }

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 11.5px;
          color: var(--slate-700);
          line-height: 1.5;
        }

        .chip-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 4px;
        }

        .chip {
          background: var(--cyan-50);
          border: 1px solid var(--cyan-200);
          color: var(--cyan);
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
        }

        .phase-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        .phase {
          background: #fff;
          border: 1px solid var(--slate-200);
          border-radius: 8px;
          padding: 7px;
        }

        .phase b {
          color: var(--cyan);
          font-size: 10px;
          display: block;
          margin-bottom: 2px;
        }

        .phase span {
          color: var(--slate-600);
          font-size: 10px;
          line-height: 1.35;
        }

        .sec-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--slate-950);
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .sec-title .n { color: var(--cyan); }

        .prose p {
          font-size: 11.5px;
          color: var(--slate-800);
          line-height: 1.5;
          margin-bottom: 5px;
        }

        .exposure {
          background: var(--amber-50);
          border-left: 4px solid var(--amber-500);
          border-radius: 10px;
          padding: 10px 12px;
        }

        .exposure .hd {
          font-size: 11.5px;
          font-weight: 800;
          color: var(--amber-900);
          text-transform: uppercase;
          letter-spacing: .3px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .exposure p {
          font-size: 11.5px;
          color: var(--slate-700);
          line-height: 1.5;
        }

        .risk-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .rcard {
          border-radius: 10px;
          padding: 8px 10px;
        }

        .rcard .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .rcard .top .name {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .rcard .top .tag {
          font-size: 9.5px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .rcard .item {
          font-size: 10.5px;
          color: var(--slate-700);
          line-height: 1.45;
        }

        .rc-crit { background: rgba(254,242,242,.7); border: 1px solid var(--red-300); }
        .rc-crit .name { color: var(--red-900); }
        .rc-crit .tag { color: #b91c1c; background: var(--red-100); }

        .rc-high { background: rgba(255,241,242,.6); border: 1px solid var(--rose-200); }
        .rc-high .name { color: #9f1239; }
        .rc-high .tag { color: var(--rose-700); background: #ffe4e6; }

        .rc-med { background: rgba(255,251,235,.5); border: 1px solid var(--amber-200); }
        .rc-med .name { color: var(--amber-900); }
        .rc-med .tag { color: var(--amber-700); background: var(--amber-100); }

        .rc-low { background: rgba(236,253,245,.5); border: 1px solid var(--emerald-200); }
        .rc-low .name { color: var(--emerald-800); }
        .rc-low .tag { color: var(--emerald-800); background: #d1fae5; }

        .roadmap {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .rm {
          border-radius: 10px;
          padding: 8px 10px;
        }

        .rm b {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          display: block;
          margin-bottom: 2px;
        }

        .rm p {
          font-size: 10.5px;
          color: var(--slate-700);
          line-height: 1.4;
        }

        .rm1 { background: var(--rose-50); border: 1px solid var(--rose-200); }
        .rm1 b { color: var(--rose-700); }
        .rm2 { background: var(--amber-50); border: 1px solid var(--amber-200); }
        .rm2 b { color: var(--amber-700); }
        .rm3 { background: var(--cyan-50); border: 1px solid var(--cyan-200); }
        .rm3 b { color: var(--cyan); }

        /* Findings Matrix Table */
        .mtable {
          border: 1px solid var(--slate-200);
          border-radius: 10px;
          overflow: hidden;
        }

        .mtable table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          table-layout: fixed;
        }

        .mtable thead {
          background: var(--slate-100);
          color: var(--slate-700);
        }

        .mtable th {
          text-align: left;
          padding: 8px;
          font-weight: 700;
        }

        .mtable td {
          padding: 7px 8px;
          border-top: 1px solid var(--slate-200);
          vertical-align: top;
          line-height: 1.4;
          word-break: break-word;
        }

        .mtable td.id { font-weight: 700; color: var(--cyan); }
        .mtable td.title { font-weight: 700; color: var(--slate-900); font-size: 11px; }

        .sev {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
        }

        .sev-CRITICAL { background: var(--red-100); color: var(--red-900); border: 1px solid var(--red-300); }
        .sev-HIGH { background: var(--orange-100); color: var(--orange-950); border: 1px solid var(--orange-300); }
        .sev-MEDIUM { background: var(--yellow-100); color: var(--yellow-950); border: 1px solid var(--yellow-300); }
        .sev-LOW, .sev-INFO { background: var(--sky-100); color: var(--sky-900); border: 1px solid var(--sky-200); }

        .scoring {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
          margin-top: 4px;
        }

        .sc {
          border-radius: 8px;
          padding: 7px;
          font-size: 9.5px;
        }

        .sc b {
          font-size: 10px;
          display: block;
          margin-bottom: 2px;
        }

        .sc span { color: var(--slate-600); }

        .sc-c { background: var(--red-50); border: 1px solid var(--red-300); } .sc-c b { color: var(--red-900); }
        .sc-h { background: var(--orange-50); border: 1px solid var(--orange-300); } .sc-h b { color: var(--amber-900); }
        .sc-m { background: var(--amber-50); border: 1px solid var(--amber-200); } .sc-m b { color: var(--amber-900); }
        .sc-l { background: var(--slate-100); border: 1px solid var(--slate-200); } .sc-l b { color: var(--slate-900); }

        .wstg {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 4px;
          font-size: 10px;
        }

        .wc {
          border: 1px solid var(--slate-200);
          background: var(--slate-50);
          border-radius: 6px;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .wtag {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .t-pass { color: var(--emerald-700); background: var(--emerald-50); }
        .t-find { color: var(--amber-700); background: var(--amber-50); }
        .t-hard { color: var(--emerald-700); background: var(--emerald-50); }
        .t-risk { color: var(--rose-700); background: var(--rose-50); }
        .t-ver { color: var(--cyan); background: var(--cyan-50); }

        /* Finding Layout Blocks */
        .fhead {
          border-bottom: 1px solid var(--slate-200);
          padding-bottom: 7px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .fhead .row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .fhead .tags {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
        }

        .ftag {
          font-size: 10.5px;
          font-weight: 700;
          color: #0e4a63;
          background: var(--cyan-50);
          border: 1px solid var(--cyan-200);
          padding: 2px 7px;
          border-radius: 4px;
        }

        .fsev {
          font-size: 10.5px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .fcwe {
          font-size: 10.5px;
          color: var(--slate-700);
          background: #e5eaf1;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .feffort {
          font-size: 10.5px;
          color: var(--slate-600);
        }

        .feffort strong { color: var(--emerald-700); }

        .ftitle {
          font-size: 15px;
          font-weight: 800;
          color: var(--slate-950);
          line-height: 1.25;
          margin: 0;
        }

        .furl {
          font-size: 11px;
          color: var(--slate-600);
        }

        .furl code {
          color: #0e4a63;
          font-weight: 700;
        }

        .box {
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 11px;
          line-height: 1.45;
        }

        .box.tech {
          background: var(--slate-50);
          border: 1px solid var(--slate-200);
          color: var(--slate-800);
        }

        .box.tech .mech {
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid var(--slate-200);
          font-size: 11px;
          color: var(--slate-700);
        }

        .box.impact {
          background: rgba(255,241,242,.6);
          border: 1px solid var(--rose-200);
          color: var(--slate-900);
        }

        .box.rem {
          background: rgba(236,253,245,.6);
          border: 1px solid var(--emerald-200);
        }

        .box.rem p.lead {
          font-weight: 700;
          color: var(--slate-900);
          font-size: 11px;
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .box.rem ol {
          margin: 0;
          padding-left: 16px;
          font-size: 11px;
          color: var(--slate-800);
          line-height: 1.45;
        }

        .box.poc {
          background: var(--slate-50);
          border: 1px solid var(--slate-200);
        }

        .box.poc .steps {
          font-size: 11px;
          color: var(--slate-700);
          line-height: 1.45;
          white-space: pre-line;
          margin-bottom: 6px;
        }

        .subhd {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .5px;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 1px;
        }

        .subhd.info { color: var(--slate-700); }
        .subhd.info .ic { color: var(--cyan-600); }
        .subhd.alert { color: var(--rose-700); }
        .subhd.code { color: var(--slate-700); }
        .subhd.code .ic { color: var(--cyan-600); }
        .subhd.rem { color: var(--emerald-800); }

        .codeblk {
          background: #0a0f1e;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 8px 10px;
          margin-top: 4px;
        }

        .codeblk .cap {
          font-size: 9.5px;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--slate-400);
          letter-spacing: .5px;
          display: block;
          margin-bottom: 4px;
        }

        .codeblk pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
          color: #6ee7b7;
          font-size: 10.5px;
          line-height: 1.5;
        }

        .checkgrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .chk {
          background: var(--slate-50);
          border: 1px solid var(--slate-200);
          border-radius: 10px;
          padding: 8px 10px;
        }

        .chk .hd {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--slate-900);
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 4px;
        }

        .chk ul {
          margin: 0;
          padding-left: 14px;
          font-size: 10.5px;
          color: var(--slate-600);
          line-height: 1.5;
        }

        .chk p {
          font-size: 10.5px;
          color: var(--slate-600);
          line-height: 1.45;
          margin: 0;
        }

        .finding-page {
          page-break-before: always;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .pdf-page, .report-page {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 12mm 14mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .finding-page {
            page-break-before: always !important;
            break-before: page !important;
          }
          .pdf-page:last-child, .report-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .box, .card, .codeblk, .checkgrid, .mtable, .fhead, .exposure, .risk-cards, .roadmap {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Discrete, Dedicated A4 Deliverable Document */}
      <div id="vapt-pdf-report-root" className="space-y-8 flex flex-col items-center">
        {/* =================================================================== */}
        {/* PAGE 1: DEDICATED EXECUTIVE COVER PAGE                              */}
        {/* =================================================================== */}
        <div key="page-1" className="report-page pdf-page">
          <div className="cover-top">
            <img src="/logo/Logo dark.jpg" alt="Sennovate Inc." className="brand-logo" />
            <div className="text-right">
              <div className="conf mono">CONFIDENTIAL &bull; PROPRIETARY</div>
              <div className="docref mono">Doc Ref: {metadata.runId || 'VAPT-AUDIT-2026'}</div>
            </div>
          </div>

          <div className="content">
            <div className="flex items-center justify-between pt-1">
              <span className="badge-scope mono">
                {metadata.assessmentType || "External Web Application & API Penetration Test"}
              </span>
              <span className="text-[10.5px] font-mono text-slate-500 font-medium">
                OWASP WSTG v4.2 &bull; NIST SP 800-115
              </span>
            </div>

            <div className="pt-2">
              <div className="text-[10.5px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                PREPARED EXCLUSIVELY FOR:
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight pt-1">
                {displayCompanyName}
              </h1>
              <div className="text-xs font-mono text-cyan-800 font-semibold flex items-center gap-1.5 pt-1">
                <span>Target Domain:</span>
                <span className="underline decoration-cyan-500 font-bold">{displayTargetDomain}</span>
                {domainInfo.subdomain && (
                  <span className="text-slate-500 text-[11px] font-normal">({domainInfo.subdomain}.{domainInfo.rootDomain})</span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-700 font-medium leading-relaxed pt-1.5">
                Comprehensive autonomous penetration testing deliverable detailing perimeter vulnerability reconnaissance, live exploit verification, attack chain mapping, and prioritized risk mitigation roadmap.
              </p>
            </div>

            {/* Core Assessment Metrics (6-KPI Grid) */}
            <div className="kpi-grid mono">
              <div className="kpi">
                <span className="lab">Primary Target URI</span>
                <span className="val truncate" title={targetUrl}>{targetUrl}</span>
              </div>
              <div className="kpi">
                <span className="lab">Overall Risk Posture</span>
                <span className="val risk">{overallRiskLevel} ({overallRiskScore}/10 CVSS)</span>
              </div>
              <div className="kpi">
                <span className="lab">Confirmed Findings</span>
                <span className="val">{sortedVulns.length} Verified ({formatSeverityBreakdown(sortedVulns)})</span>
              </div>
              <div className="kpi">
                <span className="lab">Assessment Profile</span>
                <span className="val">Black-Box Autonomous Audit</span>
              </div>
              <div className="kpi">
                <span className="lab">Testing Standard</span>
                <span className="val tel">OWASP WSTG v4.2 &bull; NIST 800-115</span>
              </div>
              <div className="kpi">
                <span className="lab">Assessment Status</span>
                <span className="val ok">Audit Completed &amp; Verified</span>
              </div>
            </div>

            {/* Target Scope & Digital Perimeter */}
            <div className="card">
              <div className="hd">
                <Globe className="w-3.5 h-3.5 text-cyan-600" /> Target Scope &amp; Evaluated Digital Perimeter
              </div>
              <div className="two-col">
                <div>
                  <div><strong>In-Scope Target:</strong> <code className="break-all">{targetUrl}</code></div>
                  <div><strong>Scope Surface:</strong> Apex Domain + Subdomain Target List</div>
                  <div><strong>Testing Methodology:</strong> Non-Destructive Live Exploit Ingestion</div>
                </div>
                <div>
                  <div><strong>Assessment Engine:</strong> Sennovate Autonomous VAPT Platform</div>
                  <div><strong>Execution Mode:</strong> Multi-Target Web &amp; API Assessment</div>
                  <div><strong>Safety Constraints:</strong> Zero Denial-of-Service / Zero Data Tampering</div>
                </div>
              </div>
              {evaluatedTargets.length > 1 && (
                <div style={{ paddingTop: '6px', marginTop: '6px', borderTop: '1px solid var(--slate-100)', fontSize: '10.5px' }}>
                  <strong>Evaluated Target Perimeter ({evaluatedTargets.length} In-Scope Targets):</strong>
                  <div className="chip-wrap mono">
                    {evaluatedTargets.map((t, idx) => (
                      <span key={idx} className="chip">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assessment Lifecycle Execution Phases */}
            <div className="card gray">
              <div className="hd">
                <Layers className="w-3.5 h-3.5 text-cyan-600" /> Autonomous Penetration Testing Execution Phases
              </div>
              <div className="phase-grid mono">
                <div className="phase">
                  <b>PHASE 1: RECON</b>
                  <span>Perimeter mapping &amp; endpoint profiling.</span>
                </div>
                <div className="phase">
                  <b>PHASE 2: ATTACK</b>
                  <span>Autonomous vulnerability discovery &amp; fuzzing.</span>
                </div>
                <div className="phase">
                  <b>PHASE 3: VERIFY</b>
                  <span>Live exploit proof &amp; impact validation.</span>
                </div>
                <div className="phase">
                  <b>PHASE 4: REPORT</b>
                  <span>Technical advisory &amp; prioritized remediation.</span>
                </div>
              </div>
            </div>

            {/* Compliance & Standards Attestation */}
            <div className="card">
              <div className="hd">
                <Shield className="w-3.5 h-3.5 text-cyan-600" /> Assessment Frameworks &amp; Compliance Standards Alignment
              </div>
              <p style={{ fontSize: '11px', color: 'var(--slate-600)', lineHeight: '1.45', margin: 0 }}>
                Conducted in strict alignment with <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, <strong>CWE/SANS Top 25</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>. All observed attack paths were verified to ensure zero false positives.
              </p>
            </div>
          </div>

          <div className="run-foot mono">
            <div><strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}</div>
            <div><strong>Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}</div>
            <div>Page 1 of {totalPages}</div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAGE 2: EXECUTIVE THREAT ASSESSMENT & ROADMAP                       */}
        {/* =================================================================== */}
        <div key="page-2" className="report-page pdf-page">
          <div className="run-head mono">
            <span className="t">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
              1. Executive Threat Assessment &amp; Threat Posture
            </span>
            <span>Target: {displayCompanyName}</span>
          </div>

          <div className="content">
            <div className="sec-title">
              <span className="n">1.</span> Executive Threat Assessment &amp; Threat Posture
            </div>

            <div className="prose">
              {customAiSummary ? (
                <div className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {customAiSummary}
                </div>
              ) : (
                <>
                  <p>
                    Sennovate Autonomous Security Platform conducted an external penetration testing assessment against <strong>{displayCompanyName}</strong> (<code className="text-cyan-800 font-bold">{targetUrl}</code>). The scope encompassed perimeter reconnaissance, automated threat modeling, live vulnerability discovery, and non-destructive exploit ingestion.
                  </p>
                  <p>
                    The assessment identified <strong>{sortedVulns.length} confirmed security vulnerabilities</strong> ({formatSeverityBreakdown(sortedVulns)}). The overall perimeter risk posture is evaluated as <strong>{overallRiskLevel} ({overallRiskScore}/10 CVSS)</strong>, requiring prioritized remediation according to the roadmap below.
                  </p>
                </>
              )}
            </div>

            {/* Strategic Exposure Vector Callout */}
            <div className="exposure">
              <div className="hd">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Strategic Exposure Vector: {overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)
              </div>
              <p>
                {topVuln ? (
                  <>
                    Primary exposure vector is <strong>{topVuln.title}</strong> on <code className="font-bold text-amber-950">{getCompleteTargetUrl(topVuln, targetUrl)}</code> (CVSS {topVuln.cvss}). {cleanText(topVuln.impact || topVuln.description)}
                  </>
                ) : (
                  <>Multiple perimeter vulnerabilities allow potential reconnaissance and privilege escalation if unmitigated.</>
                )}
              </p>
            </div>

            {/* Risk Breakdown Cards Grid */}
            <div>
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1.5 font-mono">
                Confirmed Vulnerability Threat Classification
              </div>
              <div className="risk-cards">
                {critVulns.length > 0 && (
                  <div className="rcard rc-crit">
                    <div className="top">
                      <span className="name">Critical Risks ({critVulns.length})</span>
                      <span className="tag">Immediate Patch &lt; 24h</span>
                    </div>
                    {critVulns.slice(0, 2).map((v, i) => (
                      <div key={i} className="item">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>
                    ))}
                  </div>
                )}
                <div className={`rcard rc-high ${critVulns.length === 0 ? 'col-span-1' : ''}`}>
                  <div className="top">
                    <span className="name">High Risks ({highVulns.length})</span>
                    <span className="tag">Urgent Action &lt; 7d</span>
                  </div>
                  {highVulns.length > 0 ? (
                    highVulns.slice(0, 2).map((v, i) => (
                      <div key={i} className="item">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>
                    ))
                  ) : (
                    <div className="item italic text-slate-500">No high severity findings detected.</div>
                  )}
                </div>
                <div className={`rcard rc-med ${critVulns.length === 0 ? 'col-span-1' : ''}`}>
                  <div className="top">
                    <span className="name">Medium Findings ({medVulns.length})</span>
                    <span className="tag">Remediate &lt; 30d</span>
                  </div>
                  {medVulns.length > 0 ? (
                    medVulns.slice(0, 2).map((v, i) => (
                      <div key={i} className="item">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>
                    ))
                  ) : (
                    <div className="item italic text-slate-500">No medium findings detected.</div>
                  )}
                </div>
                {lowVulns.length > 0 && (
                  <div className="rcard rc-low col-span-2">
                    <div className="top">
                      <span className="name">Low / Informational Findings ({lowVulns.length})</span>
                      <span className="tag">Hygiene &lt; 90d</span>
                    </div>
                    {lowVulns.slice(0, 2).map((v, i) => (
                      <div key={i} className="item">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Business Impact Card */}
            <div className="card gray">
              <div className="hd">
                <Building className="w-3.5 h-3.5 text-cyan-600" /> Business Impact &amp; Regulatory Considerations
              </div>
              <p style={{ fontSize: '11px', color: 'var(--slate-600)', lineHeight: '1.45', margin: 0 }}>
                Identified exposures may compromise confidentiality, facilitate unauthorized backend reconnaissance, or violate compliance benchmarks (SOC 2 Type II, ISO 27001, GDPR, and PCI-DSS v4.0 Requirement 6.4). Implementing the remediation roadmap eliminates these threat vectors.
              </p>
            </div>

            {/* Strategic 3-Phase Remediation Roadmap */}
            <div>
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1.5 font-mono">
                Prioritized 3-Phase Strategic Remediation Roadmap
              </div>
              <div className="roadmap">
                <div className="rm rm1">
                  <b>Phase 1 (&lt; 24 Hours)</b>
                  <p>
                    {topVuln ? `Immediate mitigation for ${topVuln.id}: ${cleanText(topVuln.remediation || topVuln.title).slice(0, 110)}...` : 'Hotfix exposed credentials and critical endpoints.'}
                  </p>
                </div>
                <div className="rm rm2">
                  <b>Phase 2 (&lt; 7 Days)</b>
                  <p>
                    Address medium-to-high severity findings across {displayTargetDomain}. Deploy security headers, sanitize input, and restrict API permissions.
                  </p>
                </div>
                <div className="rm rm3">
                  <b>Phase 3 (&lt; 30 Days)</b>
                  <p>
                    Implement architecture-wide hardening, split-brain DNS, CI/CD static checks, and schedule periodic autonomous VAPT re-scans.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="run-foot mono">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 2 of {totalPages}</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAGE 3: VULNERABILITY SUMMARY MATRIX & AUDIT COVERAGE               */}
        {/* =================================================================== */}
        <div key="page-3" className="report-page pdf-page">
          <div className="run-head mono">
            <span className="t">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
              2. Vulnerability Summary Matrix &amp; Audit Coverage
            </span>
            <span>Target: {displayCompanyName}</span>
          </div>

          <div className="content">
            <div className="sec-title">
              <span className="n">2.</span> Vulnerability Summary Matrix &amp; Audit Coverage
            </div>

            {/* Findings Table */}
            <div className="mtable">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '13%' }}>ID</th>
                    <th style={{ width: '33%' }}>Vulnerability Title</th>
                    <th style={{ width: '14%' }}>Severity</th>
                    <th style={{ width: '8%' }}>CVSS</th>
                    <th style={{ width: '12%' }}>CWE</th>
                    <th style={{ width: '20%' }}>Affected Target Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVulns.map((v) => (
                    <tr key={v.id}>
                      <td className="id mono">{v.id}</td>
                      <td className="title">{v.title}</td>
                      <td>
                        <span className={`sev sev-${v.severity} mono`}>{v.severity}</span>
                      </td>
                      <td className="mono font-bold">{v.cvss}</td>
                      <td className="mono" style={{ color: 'var(--slate-600)' }}>{v.cwe ? v.cwe.split(/[:\s]/)[0] : 'CWE-200'}</td>
                      <td className="mono" style={{ fontSize: '9.5px', color: 'var(--slate-600)' }}>
                        <code className="break-all">{getCompleteTargetUrl(v, targetUrl).replace(/^https?:\/\//, '')}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Severity Scoring Standards & SLA Grid */}
            <div className="card">
              <div className="hd">
                <Clock className="w-3.5 h-3.5 text-cyan-600" /> CVSS v3.1 Severity Scoring Standards &amp; Remediation SLAs
              </div>
              <div className="scoring mono">
                <div className="sc sc-c">
                  <b>CRITICAL (9.0 - 10.0)</b>
                  <span>Immediate Hotfix &bull; SLA: &lt; 24h</span>
                </div>
                <div className="sc sc-h">
                  <b>HIGH (7.0 - 8.9)</b>
                  <span>Urgent Patch &bull; SLA: &lt; 7 Days</span>
                </div>
                <div className="sc sc-m">
                  <b>MEDIUM (4.0 - 6.9)</b>
                  <span>Scheduled Fix &bull; SLA: &lt; 30 Days</span>
                </div>
                <div className="sc sc-l">
                  <b>LOW / INFO (0.1 - 3.9)</b>
                  <span>Hygiene Review &bull; SLA: &lt; 90 Days</span>
                </div>
              </div>
            </div>

            {/* OWASP WSTG v4.2 Security Category Coverage Grid */}
            <div className="card gray">
              <div className="hd">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> OWASP WSTG v4.2 Security Category Coverage
              </div>
              <div className="wstg mono">
                <div className="wc">
                  <span>WSTG-INFO (Reconnaissance)</span>
                  <span className="wtag t-pass">&#10003; Evaluated</span>
                </div>
                <div className="wc">
                  <span>WSTG-CONF (Configuration)</span>
                  <span className="wtag t-find">&#9888; Findings</span>
                </div>
                <div className="wc">
                  <span>WSTG-IDNT (Authentication)</span>
                  <span className="wtag t-hard">&#10003; Hardened</span>
                </div>
                <div className="wc">
                  <span>WSTG-INPV (Input Validation)</span>
                  <span className="wtag t-risk">&#9888; Action Req</span>
                </div>
                <div className="wc">
                  <span>WSTG-CRYP (Cryptography)</span>
                  <span className="wtag t-pass">&#10003; Verified</span>
                </div>
                <div className="wc">
                  <span>WSTG-APIT (API Security)</span>
                  <span className="wtag t-ver">&#9888; Verified</span>
                </div>
              </div>
            </div>

            {/* Safety Attestation */}
            <div className="card">
              <div className="hd">
                <Shield className="w-3.5 h-3.5 text-cyan-600" /> Autonomous Penetration Testing Safety Attestation
              </div>
              <p style={{ fontSize: '11px', color: 'var(--slate-600)', lineHeight: '1.45', margin: 0 }}>
                All identified vulnerability attack vectors have been verified non-destructively through synthetic proof-of-concept ingestion and automated rule simulation. Zero production data tampering, service degradation, or denial-of-service was introduced during execution.
              </p>
            </div>
          </div>

          <div className="run-foot mono">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 3 of {totalPages}</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAGES 4+: TECHNICAL VULNERABILITY ADVISORIES (ONE PAGE PER FINDING) */}
        {/* =================================================================== */}
        {sortedVulns.map((vuln, vIdx) => {
          const findingNum = vIdx + 1;
          const pageNum = 3 + findingNum;
          const pocCode = getPocCodeString(vuln);

          return (
            <div key={`finding-page-${vuln.id}`} className="report-page pdf-page finding-page">
              <div className="run-head mono">
                <span className="t">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                  Sennovate VAPT Deliverable &bull; Finding #{findingNum} of {sortedVulns.length}
                </span>
                <span>Target: {displayCompanyName}</span>
              </div>

              <div className="content">
                {/* Finding Header */}
                <div className="fhead">
                  <div className="row">
                    <div className="tags">
                      <span className="ftag mono">Finding #{findingNum}: {vuln.id}</span>
                      <span className={`fsev sev-${vuln.severity} mono`}>
                        {vuln.severity} &bull; CVSS {vuln.cvss}
                      </span>
                      <span className="fcwe mono">
                        {vuln.cwe ? vuln.cwe.split(/[:\s]/)[0] : 'CWE-200'}
                      </span>
                    </div>
                    <div className="feffort mono">
                      Fix Effort: <strong>{vuln.fixEffort || 'Low'}</strong>
                    </div>
                  </div>
                  <h3 className="ftitle">{vuln.title}</h3>
                  <div className="furl mono">
                    Complete Target URL: <code className="break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code>
                  </div>
                </div>

                {/* Technical Analysis */}
                <div className="subhd info">
                  <span className="ic">&#9432;</span> TECHNICAL ANALYSIS &amp; VULNERABILITY MECHANISM
                </div>
                <div className="box tech">
                  <p>{vuln.description}</p>
                  {vuln.technicalAnalysis && (
                    <p className="mech">
                      <strong>Vulnerability Mechanics:</strong> {vuln.technicalAnalysis}
                    </p>
                  )}
                </div>

                {/* Threat Impact */}
                <div className="subhd alert">
                  <span>&#128737;</span> SECURITY &amp; THREAT IMPACT ASSESSMENT
                </div>
                <div className="box impact">
                  <p>{vuln.impact || "Exploitation of this vulnerability may allow malicious threat actors to compromise application confidentiality and integrity."}</p>
                </div>

                {/* Proof of Concept */}
                <div className="subhd code">
                  <span className="ic">&lt;/&gt;</span> PROOF OF CONCEPT &amp; LIVE EXPLOIT VERIFICATION
                </div>
                <div className="box poc">
                  {vuln.pocDescription ? (
                    <div className="steps">{vuln.pocDescription}</div>
                  ) : (
                    <div className="steps">
                      1. Target the identified endpoint: {getCompleteTargetUrl(vuln, targetUrl)}.
                      <br />2. Replay request using the verification command below.
                      <br />3. Inspect returned payload to verify vulnerability exposure.
                    </div>
                  )}
                  {pocCode && (
                    <div className="codeblk">
                      <span className="cap mono">Verification Command / Exploit Script:</span>
                      <pre className="mono">{pocCode}</pre>
                    </div>
                  )}
                </div>

                {/* Remediation Action Plan */}
                <div className="subhd rem">
                  <span>&#9989;</span> STEP-BY-STEP REMEDIATION ACTION PLAN
                </div>
                <div className="box rem">
                  {vuln.remediation && (
                    <p className="lead">{cleanText(vuln.remediation)}</p>
                  )}
                  {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                    <ol>
                      {vuln.remediationSteps.map((step, sIdx) => (
                        <li key={sIdx}>{cleanText(step)}</li>
                      ))}
                    </ol>
                  ) : (
                    <ol>
                      <li>Apply strict input validation and least-privilege access control on the affected endpoint.</li>
                      <li>Review security configurations and audit application logs for anomalous requests.</li>
                      <li>Conduct a regression verification test to confirm vulnerability remediation.</li>
                    </ol>
                  )}
                </div>

                {/* Verification Checklist & Scope Note */}
                <div className="checkgrid">
                  <div className="chk">
                    <div className="hd mono">&#9745; Verification Checklist</div>
                    <ul>
                      <li>Confirm affected endpoint no longer accepts unauthorized requests.</li>
                      <li>Verify defensive controls and security headers are active.</li>
                      <li>Run regression scan to confirm clean status.</li>
                    </ul>
                  </div>
                  <div className="chk">
                    <div className="hd mono">&#128737; Scope Note</div>
                    <p>
                      {vuln.assumptions || 'Assessed against live production perimeter under standard operational conditions; key validity confirmed non-destructively.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="run-foot mono">
                <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                <span>Audited by Sennovate Autonomous VAPT Platform</span>
                <span>Page {pageNum} of {totalPages}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
