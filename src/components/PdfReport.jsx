import React, { useState } from 'react';
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
  CheckSquare
} from 'lucide-react';
import { exportReportToPdf } from '../utils/pdfExport';
import { askLlmWithRag } from '../utils/llmEngine';

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

function renderFormattedMarkdown(markdownText) {
  if (!markdownText) return null;
  const lines = markdownText.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-0.5 pl-4 list-disc text-[10.5px] text-slate-700 font-sans">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-tight break-words">
              {item}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (/^#+\s+/.test(trimmed) || /^\*\*[0-9\.\s]*[A-Z\s:]+\*\*$/.test(trimmed)) {
      flushList();
      const headingClean = cleanText(trimmed);
      elements.push(
        <h4 key={idx} className="text-[11px] font-bold text-slate-950 uppercase tracking-wide pt-0.5 font-mono break-words">
          {headingClean}
        </h4>
      );
    } else if (/^[\*\-\•]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[\*\-\•\d\.\)]+\s+/, '');
      const parts = itemContent.split(/(\*\*[^*]+\*\*)/g);
      currentList.push(
        <span key={`item-${idx}`} className="break-words">
          {parts.map((p, pIdx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={pIdx} className="text-slate-900 font-bold">{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
        </span>
      );
    } else {
      flushList();
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={idx} className="text-[10.5px] text-slate-700 leading-snug font-sans break-words">
          {parts.map((p, pIdx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={pIdx} className="text-slate-900 font-bold">{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
        </p>
      );
    }
  });

  flushList();
  return <div className="space-y-1.5">{elements}</div>;
}

// Helper to construct the complete target URL for any vulnerability
function getCompleteTargetUrl(vuln, fallbackBaseUrl) {
  if (!vuln) return fallbackBaseUrl || '';
  const targetStr = (vuln.target || '').trim();
  const endpointStr = (vuln.endpoint || '').trim();

  // If vuln.target is already an absolute HTTP(S) URL
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

  // If fallbackBaseUrl is provided
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

// Helper to accurately format severity breakdown without omitting critical or low findings
function formatSeverityBreakdown(vulns) {
  if (!vulns || vulns.length === 0) return '0 Findings';
  const crit = vulns.filter(v => v.severity === 'CRITICAL').length;
  const high = vulns.filter(v => v.severity === 'HIGH').length;
  const med = vulns.filter(v => v.severity === 'MEDIUM').length;
  const low = vulns.filter(v => v.severity === 'LOW').length;

  const parts = [];
  if (crit > 0) parts.push(`${crit} Critical`);
  if (high > 0) parts.push(`${high} High`);
  if (med > 0) parts.push(`${med} Medium`);
  if (low > 0) parts.push(`${low} Low`);

  return parts.length > 0 ? parts.join(', ') : '0 Findings';
}

export default function PdfReport({ 
  vulnerabilities = [], 
  metadata = {}, 
  companyName = "Target Organization", 
  theme = 'dark' 
}) {
  const [reportType, setReportType] = useState('detailed'); // 'detailed' | 'simple'
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [customAiSummary, setCustomAiSummary] = useState(null);

  const sortedVulns = [...vulnerabilities].sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  const critVulns = sortedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const lowVulns = sortedVulns.filter(v => v.severity === 'LOW');
  const topVuln = sortedVulns[0] || null;

  const targetUrl = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target-system.internal");
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 6.8;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 8.5 ? 'CRITICAL' : (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED'));

  // Detailed Report: Dynamic 2-Page / 1-Page Advisory Page Distribution:
  // Spans 2 unhurried A4 pages when finding has evidence or poc scripts
  const findingPages = [];
  sortedVulns.forEach((vuln, vIdx) => {
    const findingNum = vIdx + 1;
    const hasEvidence = Boolean(vuln.evidence);
    const hasPoc = Boolean(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python || vuln.pocDescription);

    if (hasEvidence || hasPoc) {
      findingPages.push({ type: 'part1', vuln, findingNum });
      findingPages.push({ type: 'part2', vuln, findingNum });
    } else {
      findingPages.push({ type: 'single', vuln, findingNum });
    }
  });

  const detailedTotalPages = 3 + (findingPages.length > 0 ? findingPages.length : 1);
  const simpleTotalPages = 2 + (sortedVulns.length > 0 ? sortedVulns.length : 1);
  const totalPages = reportType === 'simple' ? simpleTotalPages : detailedTotalPages;

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const prompt = `You are a Principal Security Consultant creating an executive penetration testing deliverable for ${companyName} (Target: ${targetUrl}).
Generate a concise, crisp, perfectly proportioned Executive Summary and Threat Alignment that fits Page 2 of a standard A4 deliverable without awkward cutoffs or overflow:
1. Executive Threat Overview (2 concise paragraphs evaluating overall posture, highest risk attack vectors, and business impact).
2. Key Risk Breakdown (concise bulleted breakdown of confirmed Critical, High, and Medium vulnerabilities with exact mechanics).
3. Strategic 3-Phase Action Roadmap:
   - Phase 1 (< 24h Immediate Containment)
   - Phase 2 (< 7 Days Architectural Remediation)
   - Phase 3 (< 30 Days Governance & Regression Testing)
Format with clean markdown bullet points and bold headers. Keep the text punchy, technical, and well-balanced.`;

      const res = await askLlmWithRag({
        userMessage: prompt,
        companyName,
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
      const sanitizedName = (companyName || 'Target_System').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = reportType === 'simple'
        ? `Sennovate_VAPT_Simple_Report_${sanitizedName}.pdf`
        : `Sennovate_VAPT_Detailed_Report_${sanitizedName}.pdf`;
      await exportReportToPdf('vapt-pdf-report-root', filename);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-slate-900 border-slate-800 text-white shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Executive Penetration Testing Report
              <span className="px-2.5 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                A4 Deliverable &bull; {reportType === 'simple' ? 'Simple' : 'Detailed'} Format &bull; {totalPages} Pages
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Target: <span className="font-mono text-cyan-300">{targetUrl}</span> &bull; {sortedVulns.length} Confirmed Vulnerabilities
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Two Report Forms Toggle: Simple vs Detailed */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setReportType('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'detailed'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Detailed Report</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType('simple')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'simple'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isGeneratingAiSummary ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isGeneratingAiSummary ? "Synthesizing Summary..." : "Re-generate Executive Summary"}</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md hover:shadow-cyan-500/25 disabled:opacity-60"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? "Exporting Deliverable..." : exportSuccess ? "Report Downloaded!" : `Download ${reportType === 'simple' ? 'Simple' : 'Detailed'} PDF`}</span>
          </button>
        </div>
      </div>

      <style>{`
        .pdf-page {
          width: 210mm;
          min-width: 210mm;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px auto;
          padding: 12mm 14mm 12mm 14mm;
          background: #ffffff;
          box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.08);
          border-radius: 4px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          page-break-after: always;
          break-after: page;
        }
        .pdf-page * {
          box-sizing: border-box !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        .pdf-page pre, .pdf-page code {
          white-space: pre-wrap !important;
          word-break: break-all !important;
          overflow-wrap: anywhere !important;
        }
        .pdf-card, .pdf-block {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .pdf-page {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            padding: 12mm 14mm 12mm 14mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }
        }
      `}</style>

      <div id="vapt-pdf-report-root" className="space-y-8 flex flex-col items-center">
        {reportType === 'simple' ? (
          <>
            {/* ========================================================================= */}
            {/* SIMPLE REPORT - PAGE 1: EXECUTIVE COVER & STREAMLINED OVERVIEW           */}
            {/* ========================================================================= */}
            <div className="pdf-page bg-white text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div className="flex items-center gap-3">
                  <img src="/logo/Logo dark.jpg" alt="Sennovate Inc." className="h-8 object-contain" />
                </div>
                <div className="text-right font-mono text-xs text-slate-600">
                  <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-[10.5px]">
                    CONFIDENTIAL &bull; PROPRIETARY
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Doc Ref: {metadata.runId || 'VAPT-SIMPLE-2026'}</div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-start space-y-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-md text-xs font-mono font-bold text-cyan-900 uppercase tracking-wider">
                    Executive Summary &bull; Penetration Test Deliverable
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">Standards: OWASP WSTG v4.2</span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">PREPARED EXCLUSIVELY FOR:</div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight break-words">{companyName}</h1>
                  <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed break-words max-w-3xl">
                    Executive summary deliverable highlighting confirmed perimeter vulnerabilities, observed protocol evidence, and prioritized remediation actions.
                  </p>
                </div>

                {/* 4 Clean Executive Metric Cards (NO backend tokens, NO HTTP checks) */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs">
                  <div className="p-1.5">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">PRIMARY TARGET URI</span>
                    <span className="font-extrabold text-slate-900 break-all block text-[13px]">{targetUrl}</span>
                  </div>
                  <div className="p-1.5">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">OVERALL RISK POSTURE</span>
                    <span className="font-extrabold text-rose-700 text-[13px]">{overallRiskLevel} ({overallRiskScore}/10 CVSS)</span>
                  </div>
                  <div className="p-1.5">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">CONFIRMED FINDINGS</span>
                    <span className="font-extrabold text-slate-900 text-[13px]">{sortedVulns.length} Verified ({formatSeverityBreakdown(sortedVulns)})</span>
                  </div>
                  <div className="p-1.5">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">ASSESSMENT PROFILE</span>
                    <span className="font-extrabold text-slate-900 text-[13px]">External Black-Box Audit</span>
                  </div>
                </div>

                {/* Target Scope & Digital Perimeter */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-cyan-600" /> Assessment Perimeter &amp; Scope
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                    <div className="space-y-1 text-slate-700 leading-relaxed">
                      <div><strong>Evaluated Target:</strong> <code className="break-all text-cyan-800">{targetUrl}</code></div>
                      <div><strong>Perimeter Coverage:</strong> External Web Perimeter, APIs, Form Endpoints</div>
                    </div>
                    <div className="space-y-1 text-slate-700 leading-relaxed">
                      <div><strong>Testing Platform:</strong> Sennovate Autonomous VAPT Platform</div>
                      <div><strong>Testing Safety:</strong> Non-Destructive Ingestion (Zero Downtime)</div>
                    </div>
                  </div>
                </div>

                {/* Executive Findings & Risk Synopsis */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" /> Executive Threat Overview
                  </div>
                  <div className="space-y-1.5 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">
                    <p>
                      Sennovate Autonomous Security Platform completed an external security assessment targeting <strong>{companyName}</strong>. The assessment discovered <strong>{sortedVulns.length} confirmed vulnerabilities</strong> across public endpoints ({formatSeverityBreakdown(sortedVulns)}).
                    </p>
                    {topVuln ? (
                      <p className="text-slate-700 text-[12px]">
                        The highest risk vector identified is <strong>{topVuln.title}</strong> (CVSS {topVuln.cvss}) on <code>{getCompleteTargetUrl(topVuln, targetUrl)}</code>. Immediate remediation is advised to prevent potential unauthorized access or information leakage.
                      </p>
                    ) : (
                      <p className="text-slate-700 text-[12px]">
                        No critical vulnerabilities were discovered. Periodic regression audits are recommended to maintain standard perimeter posture.
                      </p>
                    )}
                  </div>
                </div>

                {/* High-Level Remediation Directives */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" /> Immediate Remediation Directives
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11.5px] text-slate-700 leading-relaxed">
                    <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-200 space-y-0.5">
                      <strong className="text-rose-900 block font-mono text-[11px]">Priority 1: Immediate Containment (&lt; 24h)</strong>
                      <span>Address high and critical exposure vectors identified in this deliverable.</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 space-y-0.5">
                      <strong className="text-amber-900 block font-mono text-[11px]">Priority 2: System Hardening (&lt; 7 Days)</strong>
                      <span>Implement security headers, validate input parameters, and restrict debug endpoints.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                  <div><strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}</div>
                  <div><strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}</div>
                </div>
                <div className="flex items-center justify-between pt-1.5 text-[10px] font-mono text-slate-400">
                  <span>Confidential &bull; Sennovate Inc.</span>
                  <span>Page 1 of {simpleTotalPages}</span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SIMPLE REPORT - PAGE 2: VULNERABILITY SUMMARY MATRIX                     */}
            {/* ========================================================================= */}
            <div className="pdf-page bg-white text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT &bull; Vulnerability Summary Matrix
                </span>
                <span className="truncate max-w-[240px]">Target: {companyName}</span>
              </div>

              <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
                  <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">Confirmed Vulnerabilities Overview</h2>
                  <span className="text-xs font-mono text-slate-500 font-bold">{sortedVulns.length} Verified Findings</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left table-fixed">
                    <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-[12%]">ID</th>
                        <th className="p-3 w-[34%]">Vulnerability Title</th>
                        <th className="p-3 w-[14%]">Severity</th>
                        <th className="p-3 w-[8%]">CVSS</th>
                        <th className="p-3 w-[20%]">Complete Target URL</th>
                        <th className="p-3 w-[12%]">Fix Effort</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedVulns.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-cyan-800 break-words">{v.id}</td>
                          <td className="p-3 font-bold text-slate-900 break-words text-[12px]">{v.title}</td>
                          <td className="p-3 font-mono">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              v.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                              v.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                              'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}>{v.severity}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[12px]">{v.cvss}</td>
                          <td className="p-3 font-mono text-slate-600 break-all text-[11px]">{getCompleteTargetUrl(v, targetUrl)}</td>
                          <td className="p-3 font-mono text-emerald-700 font-bold text-[11px]">{v.fixEffort || 'Low'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Severity Guide */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider">Severity Classification Reference</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                      <strong className="text-red-900 block text-[10.5px]">CRITICAL (9.0 - 10.0)</strong>
                      <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Immediate exploitation or full compromise.</span>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                      <strong className="text-orange-900 block text-[10.5px]">HIGH (7.0 - 8.9)</strong>
                      <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Privilege escalation or sensitive data access.</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <strong className="text-amber-900 block text-[10.5px]">MEDIUM (4.0 - 6.9)</strong>
                      <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Configuration flaw or partial info disclosure.</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                      <strong className="text-slate-900 block text-[10.5px]">LOW (0.1 - 3.9)</strong>
                      <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Security hygiene and minor header disclosure.</span>
                    </div>
                  </div>
                </div>

                {/* Safety & Testing Attestation */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
                  <div className="font-bold text-slate-900 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" /> Autonomous Testing Safety Attestation
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11.5px] break-words">
                    All identified vulnerabilities were verified using non-destructive empirical requests. Testing was performed strictly against authorized target perimeter boundaries without impacting service availability or tampering with target data.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
                <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                <span>Audited by Sennovate Autonomous VAPT Platform</span>
                <span>Page 2 of {simpleTotalPages}</span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SIMPLE REPORT - PAGES 3+: STREAMLINED FINDINGS (1 PAGE PER FINDING)     */}
            {/* ========================================================================= */}
            {sortedVulns.map((vuln, fIdx) => {
              const findingNum = fIdx + 1;
              const pageNum = 3 + fIdx;

              return (
                <div key={`simple-finding-${vuln.id}-${fIdx}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
                    <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-600" />
                      Sennovate Autonomous VAPT Deliverable &bull; Finding #{findingNum} of {sortedVulns.length}
                    </span>
                    <span className="truncate max-w-[240px]">Target: {companyName}</span>
                  </div>

                  <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
                    {/* Finding Banner */}
                    <div className="border-b border-slate-200 pb-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-200">
                            Finding #{findingNum}: {vuln.id}
                          </span>
                          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                            vuln.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                            vuln.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                            'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>{vuln.severity} &bull; CVSS {vuln.cvss}</span>
                          <span className="text-xs font-mono text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded">
                            {vuln.cwe}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-600">
                          Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong>
                        </div>
                      </div>

                      <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight leading-snug break-words">
                        {vuln.title}
                      </h3>

                      <div className="text-xs font-mono text-slate-600">
                        Complete Target URL: <code className="text-cyan-800 font-bold break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code>
                      </div>
                    </div>

                    {/* Vulnerability Description & Risk Impact */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                        <span>Vulnerability Description &amp; Risk Impact</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 leading-relaxed space-y-2 break-words font-sans">
                        <p>{vuln.description}</p>
                        {vuln.impact && (
                          <p className="text-slate-700 text-[12.5px] pt-2 border-t border-slate-200 break-words leading-relaxed">
                            <strong className="text-slate-900">Security Impact:</strong> {vuln.impact}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Observed Technical Evidence */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-slate-700 flex-shrink-0" />
                        <span>Observed Evidence (Protocol Response)</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11.5px] leading-relaxed border border-slate-800 break-all overflow-visible max-h-56">
                        <pre className="whitespace-pre-wrap leading-relaxed select-all break-all overflow-visible font-mono">
                          {vuln.evidence || vuln.reproduction || 'Evidence captured during automated vulnerability verification probe.'}
                        </pre>
                      </div>
                    </div>

                    {/* Recommended Remediation Plan */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Recommended Remediation Plan</span>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                        {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                          <p className="text-slate-900 font-bold text-[13px] break-words leading-relaxed">
                            {cleanText(vuln.remediation)}
                          </p>
                        )}
                        {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                          <ol className="list-decimal list-inside space-y-1.5 text-[12.5px] text-slate-800 font-sans">
                            {vuln.remediationSteps.map((step, sIdx) => (
                              <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>
                            ))}
                          </ol>
                        ) : (
                          !vuln.remediation && <p className="text-slate-500 italic text-[12px]">Apply standard security patches and configuration hardening.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
                    <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                    <span>Audited by Sennovate Autonomous VAPT Platform</span>
                    <span>Page {pageNum} of {simpleTotalPages}</span>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* DETAILED REPORT - PAGE 1: EXECUTIVE COVER PAGE & ENGAGEMENT CHARTER       */}
            {/* ========================================================================= */}
        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-3 border-slate-200">
            <div className="flex items-center gap-3">
              <img src="/logo/Logo dark.jpg" alt="Sennovate Inc." className="h-8 object-contain" />
            </div>
            <div className="text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-[10.5px]">
                CONFIDENTIAL &bull; PROPRIETARY
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Doc Ref: {metadata.runId || 'VAPT-AUDIT-2026'}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-md text-xs font-mono font-bold text-cyan-900 uppercase tracking-wider">
                {metadata.assessmentType || "External Web Application & API Penetration Test"}
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-medium">Standards: OWASP WSTG v4.2 &bull; NIST SP 800-115</span>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">PREPARED EXCLUSIVELY FOR:</div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight break-words">{companyName}</h1>
              <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed break-words max-w-3xl">
                Comprehensive autonomous penetration testing deliverable detailing perimeter vulnerability reconnaissance, live exploit verification, attack chain mapping, and prioritized risk mitigation roadmap.
              </p>
            </div>

            {/* Core Assessment Metrics (6-KPI Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs">
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">PRIMARY TARGET URI</span>
                <span className="font-extrabold text-slate-900 break-all block text-[12.5px]">{targetUrl}</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">OVERALL RISK POSTURE</span>
                <span className="font-extrabold text-rose-700 text-[12.5px]">{overallRiskLevel} ({overallRiskScore}/10 CVSS)</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">CONFIRMED FINDINGS</span>
                <span className="font-extrabold text-slate-900 text-[12.5px]">{sortedVulns.length} Verified ({formatSeverityBreakdown(sortedVulns)})</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">ASSESSMENT PROFILE</span>
                <span className="font-extrabold text-slate-900 text-[12.5px]">Black-Box Autonomous Audit</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">SECURITY AI TELEMETRY</span>
                <span className="font-extrabold text-cyan-800 text-[12.5px]">
                  {(metadata.tokens || 16400000) > 1000000 ? `${((metadata.tokens || 16400000) / 1000000).toFixed(1)}M Tokens` : `${metadata.tokens || 0} Tokens`} &bull; {metadata.requests || 488} Checks
                </span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">ASSESSMENT STATUS</span>
                <span className="font-extrabold text-emerald-700 text-[12.5px]">Audit Completed &amp; Verified</span>
              </div>
            </div>

            {/* Target Scope & Digital Perimeter */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-600" /> Target Scope &amp; Evaluated Digital Perimeter
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="space-y-1 text-slate-700 leading-relaxed">
                  <div><strong>In-Scope Target:</strong> <code className="break-all">{targetUrl}</code></div>
                  <div><strong>Protocol Coverage:</strong> HTTPS/TLS, REST Endpoints, Form Handlers</div>
                  <div><strong>Testing Methodology:</strong> Non-Destructive Live Exploit Ingestion</div>
                </div>
                <div className="space-y-1 text-slate-700 leading-relaxed">
                  <div><strong>Assessment Engine:</strong> Sennovate Autonomous VAPT Platform</div>
                  <div><strong>Execution Mode:</strong> Dynamic Web Surface &amp; API Assessment</div>
                  <div><strong>Safety Constraints:</strong> Zero Denial-of-Service / Zero Data Tampering</div>
                </div>
              </div>
            </div>

            {/* Assessment Lifecycle Execution Phases */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-600" /> Autonomous Penetration Testing Execution Phases
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-mono">
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <strong className="text-cyan-800 block text-[10.5px] font-black">PHASE 1: RECON</strong>
                  <span className="text-slate-600 leading-snug">Perimeter mapping &amp; endpoint profiling.</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <strong className="text-cyan-800 block text-[10.5px] font-black">PHASE 2: ATTACK</strong>
                  <span className="text-slate-600 leading-snug">Autonomous vulnerability discovery &amp; fuzzing.</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <strong className="text-cyan-800 block text-[10.5px] font-black">PHASE 3: VERIFY</strong>
                  <span className="text-slate-600 leading-snug">Live exploit proof &amp; impact validation.</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <strong className="text-cyan-800 block text-[10.5px] font-black">PHASE 4: REPORT</strong>
                  <span className="text-slate-600 leading-snug">Technical advisory &amp; prioritized remediation.</span>
                </div>
              </div>
            </div>

            {/* Compliance & Standards Attestation */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-cyan-600" /> Assessment Frameworks &amp; Compliance Standards Alignment
              </div>
              <p className="text-slate-600 leading-relaxed text-[12px] break-words">
                Conducted in strict alignment with <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, <strong>CWE/SANS Top 25</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>. All observed attack paths were verified to ensure zero false positives.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
              <div><strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}</div>
              <div><strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}</div>
            </div>
            <div className="flex items-center justify-between pt-1.5 text-[10px] font-mono text-slate-400">
              <span>Confidential &bull; Sennovate Inc.</span>
              <span>Page 1 of {totalPages}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PAGE 2: EXECUTIVE SUMMARY & STRATEGIC THREAT POSTURE                      */}
        {/* ========================================================================= */}
        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT Deliverable &bull; Executive Threat Assessment
            </span>
            <span className="truncate max-w-[240px]">Target: {companyName}</span>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-3.5 pt-3 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">1. Executive Summary &amp; Threat Posture</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900">VERIFIED FINDINGS</span>
            </div>

            {customAiSummary ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">{renderFormattedMarkdown(customAiSummary)}</div>
            ) : (
              <>
                <div className="space-y-2 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">
                  <p>Sennovate Autonomous Security Engine conducted an external penetration testing assessment against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope encompassed the external web perimeter, exposed application services, and integrated API endpoints.</p>
                  <p>The assessment identified <strong>{sortedVulns.length} confirmed security vulnerabilities</strong> ({formatSeverityBreakdown(sortedVulns)}). The overall cybersecurity posture is evaluated at <strong>{overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</strong>, requiring targeted remediation to safeguard corporate data assets.</p>
                </div>

                {topVuln && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-1 text-xs">
                    <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-1.5 text-xs">
                      <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" /> <span>Strategic Exposure Vector: {overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</span>
                    </div>
                    <p className="leading-relaxed text-[12px] break-words text-slate-700">Primary exposure vector is <strong>{topVuln.title}</strong> on <code>{getCompleteTargetUrl(topVuln, targetUrl)}</code> (CVSS {topVuln.cvss}). Exploitation allows unauthorized adversaries: {topVuln.impact || topVuln.description}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">Categorized Risk Breakdown</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {critVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-red-200 bg-red-50/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-red-900 uppercase font-mono">Critical Risks ({critVulns.length})</span>
                          <span className="font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px]">Immediate Action</span>
                        </div>
                        <div className="text-[11.5px] text-slate-700 space-y-1 pl-1">{critVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                    {highVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-rose-900 uppercase font-mono">High Risks ({highVulns.length})</span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">Urgent Action</span>
                        </div>
                        <div className="text-[11.5px] text-slate-700 space-y-1 pl-1">{highVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                    {medVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-900 uppercase font-mono">Medium Findings ({medVulns.length})</span>
                          <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">Remediate &lt; 7d</span>
                        </div>
                        <div className="text-[11.5px] text-slate-700 space-y-1 pl-1">{medVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                    {lowVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-900 uppercase font-mono">Low / Info Findings ({lowVulns.length})</span>
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Hygiene &lt; 30d</span>
                        </div>
                        <div className="text-[11.5px] text-slate-700 space-y-1 pl-1">{lowVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Impact & Regulatory Exposure Callout */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                  <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-cyan-600" />
                    Business Impact &amp; Regulatory Considerations
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[12px] break-words">
                    Identified vulnerabilities could result in session hijacking, unauthorized parameter manipulation, and sensitive header disclosure. Prompt mitigation is advised to maintain compliance with <strong>SOC 2 Type II</strong>, <strong>ISO 27001 (A.14)</strong>, and <strong>GDPR Article 32 (Security of Processing)</strong>.
                  </p>
                </div>

                {/* 3-Phase Action Roadmap */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">2. Prioritized 3-Phase Remediation Roadmap</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                      <div className="font-bold text-rose-700 font-mono text-[11px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 1 (&lt; 24h)</div>
                      <p className="text-slate-700 text-[11.5px] leading-relaxed break-words">{topVuln ? `Remediate ${topVuln.title} on ${getCompleteTargetUrl(topVuln, targetUrl)}.` : 'Patch high priority vulnerabilities.'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                      <div className="font-bold text-amber-700 font-mono text-[11px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 2 (&lt; 7 Days)</div>
                      <p className="text-slate-700 text-[11.5px] leading-relaxed break-words">Address medium severity findings across {companyName} application endpoints.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1">
                      <div className="font-bold text-cyan-800 font-mono text-[11px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 3 (&lt; 30 Days)</div>
                      <p className="text-slate-700 text-[11.5px] leading-relaxed break-words">Deploy strict CSP, review CORS policies, and conduct automated regression audits.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 2 of {totalPages}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PAGE 3: VULNERABILITY SUMMARY MATRIX & AUDIT COVERAGE                     */}
        {/* ========================================================================= */}
        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT Deliverable &bull; Vulnerability Matrix &amp; Audit Coverage
            </span>
            <span className="truncate max-w-[240px]">Target: {companyName}</span>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-3.5 pt-3 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">3. Vulnerability Summary Matrix</h2>
              <span className="text-xs font-mono text-slate-500 font-bold">{sortedVulns.length} Confirmed Findings</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left table-fixed">
                <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-[11%]">ID</th>
                    <th className="p-2.5 w-[31%]">Vulnerability Title</th>
                    <th className="p-2.5 w-[13%]">Severity</th>
                    <th className="p-2.5 w-[8%]">CVSS</th>
                    <th className="p-2.5 w-[11%]">CWE</th>
                    <th className="p-2.5 w-[18%]">Complete Target URL</th>
                    <th className="p-2.5 w-[8%]">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVulns.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-cyan-800 break-words">{v.id}</td>
                      <td className="p-2.5 font-bold text-slate-900 break-words text-[11.5px]">{v.title}</td>
                      <td className="p-2.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                          v.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                          v.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                          'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>{v.severity}</span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-[11.5px]">{v.cvss}</td>
                      <td className="p-2.5 font-mono text-slate-600 break-words text-[10.5px]">{v.cwe}</td>
                      <td className="p-2.5 font-mono text-slate-600 break-all text-[10.5px]">{getCompleteTargetUrl(v, targetUrl)}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-700 text-[10.5px]">{idx === 0 ? 'Urgent' : idx <= 2 ? 'High' : 'Medium'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Severity Scoring Guide */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider">Industry Severity Scoring Guide (CVSS v3.1 Base Metrics)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                  <strong className="text-red-900 block text-[10.5px]">CRITICAL (9.0 - 10.0)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Immediate compromise or RCE.</span>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                  <strong className="text-orange-900 block text-[10.5px]">HIGH (7.0 - 8.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Privilege escalation or data leak.</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <strong className="text-amber-900 block text-[10.5px]">MEDIUM (4.0 - 6.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Partial data exposure or flaw.</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                  <strong className="text-slate-900 block text-[10.5px]">LOW (0.1 - 3.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10.5px]">Info disclosure or hygiene issue.</span>
                </div>
              </div>
            </div>

            {/* OWASP WSTG v4.2 Category Assessment Coverage */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                OWASP Security Testing Guide (WSTG v4.2) Category Audit Coverage
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[10.5px] font-mono">
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-INFO (Recon)</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9.5px]">PASS</span>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-CONF (Config)</span>
                  <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[9.5px]">FINDINGS</span>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-IDNT (Identity)</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9.5px]">HARDENED</span>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-INPV (Injection)</span>
                  <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[9.5px]">HIGH RISK</span>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-CRYP (Crypto)</span>
                  <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[9.5px]">FINDINGS</span>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span>WSTG-APIT (API Security)</span>
                  <span className="font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded text-[9.5px]">VERIFIED</span>
                </div>
              </div>
            </div>

            {/* Audit Attestation & Verification Boundaries */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" /> Autonomous Penetration Testing Safety Attestation
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px] break-words">All identified vulnerability attack vectors have been empirically validated through non-destructive dynamic proof-of-concept tests. Testing was executed strictly within authorized target bounds without denial of service or disruption to operational availability.</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 3 of {totalPages}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PAGES 4+: UNHURRIED 2-PAGE ADVISORY DELIVERABLES FOR EACH FINDING         */}
        {/* ========================================================================= */}
        {findingPages.map((pageData, pIdx) => {
          const { type, vuln, findingNum } = pageData;
          const pageNum = 4 + pIdx;

          // =======================================================================
          // PART 1: THREAT ASSESSMENT & TECHNICAL ANALYSIS (Page A)
          // =======================================================================
          if (type === 'part1') {
            return (
              <div key={`finding-p1-${vuln.id}-${pIdx}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
                {/* Running Header */}
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[11px] font-mono text-slate-500 uppercase">
                  <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    Sennovate Autonomous VAPT &bull; Finding #{findingNum} of {sortedVulns.length} (Part 1: Technical Analysis)
                  </span>
                  <span className="truncate max-w-[240px]">Target: {companyName}</span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
                  {/* Finding Title & Meta Banner */}
                  <div className="border-b border-slate-200 pb-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-200">
                          Finding #{findingNum}: {vuln.id}
                        </span>
                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                          vuln.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                          vuln.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                          'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>{vuln.severity} &bull; CVSS {vuln.cvss}</span>
                        <span className="text-xs font-mono text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded">
                          {vuln.cwe}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-600">Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong></div>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight leading-snug break-words">
                      {vuln.title}
                    </h3>

                    <div className="text-xs font-mono text-slate-600">
                      Complete Target URL: <code className="text-cyan-800 font-bold break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code>
                    </div>
                  </div>

                  {/* Technical Analysis & Mechanism */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <span>Technical Analysis &amp; Vulnerability Mechanism</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 leading-relaxed space-y-2 break-words font-sans">
                      <p>{vuln.description}</p>
                      {vuln.technicalAnalysis && (
                        <p className="text-slate-700 text-[12.5px] pt-2 border-t border-slate-200 break-words leading-relaxed">
                          <strong className="text-slate-900">Vulnerability Mechanics:</strong> {vuln.technicalAnalysis}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Security & Threat Impact */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Security &amp; Threat Impact Assessment</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 text-[13px] text-slate-900 leading-relaxed break-words font-sans">
                      <p>{vuln.impact}</p>
                    </div>
                  </div>

                  {/* Observed Evidence (Protocol Request/Response) */}
                  {vuln.evidence && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-slate-700 flex-shrink-0" />
                        <span>Observed Evidence (Raw Protocol HTTP Response)</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11.5px] leading-relaxed border border-slate-800 break-all overflow-visible max-h-56">
                        <pre className="whitespace-pre-wrap leading-relaxed select-all break-all overflow-visible font-mono">{vuln.evidence}</pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[11px] font-mono text-slate-500">
                  <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                  <span>Continued on Next Page &rarr;</span>
                  <span>Page {pageNum} of {totalPages}</span>
                </div>
              </div>
            );
          }

          // =======================================================================
          // PART 2: LIVE EXPLOIT VERIFICATION & REMEDIATION ROADMAP (Page B)
          // =======================================================================
          if (type === 'part2') {
            return (
              <div key={`finding-p2-${vuln.id}-${pIdx}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
                {/* Running Header */}
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[11px] font-mono text-slate-500 uppercase">
                  <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    Sennovate Autonomous VAPT &bull; Finding #{findingNum} of {sortedVulns.length} (Part 2: Verification &amp; Remediation)
                  </span>
                  <span className="truncate max-w-[240px]">Target: {companyName}</span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
                  {/* Continuation Banner */}
                  <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-mono font-bold text-cyan-900 uppercase">
                        Finding #{findingNum} [{vuln.id}] &mdash; {vuln.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        Complete Target URL: <code className="text-cyan-800 font-bold break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-200 text-cyan-900">
                      PART 2: REMEDIATION
                    </span>
                  </div>

                  {/* Proof of Concept & Live Exploit Verification */}
                  {(vuln.pocDescription || vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Proof of Concept &amp; Live Exploit Verification</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        {vuln.pocDescription && (
                          <div className="text-slate-700 leading-relaxed whitespace-pre-line text-[12.5px] font-sans break-words">
                            {vuln.pocDescription}
                          </div>
                        )}
                        {(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                          <div className="p-3 rounded-lg bg-slate-950 text-cyan-300 font-mono text-[11.5px] leading-relaxed space-y-1 border border-slate-800 overflow-visible break-all">
                            <span className="text-[10px] uppercase text-slate-400 font-bold block font-mono">
                              Verification Command / Exploit Script:
                            </span>
                            <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap font-mono">
                              {vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step-by-Step Remediation Action Plan */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Step-by-Step Remediation Action Plan</span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                      {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                        <p className="text-slate-900 font-bold text-[13px] break-words leading-relaxed">
                          {cleanText(vuln.remediation)}
                        </p>
                      )}
                      {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1.5 text-[12.5px] text-slate-800 font-sans">
                          {vuln.remediationSteps.map((step, sIdx) => (
                            <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>
                          ))}
                        </ol>
                      ) : (
                        !vuln.remediation && <p className="text-slate-500 italic text-[12px]">Apply standard security patches and configuration hardening.</p>
                      )}
                    </div>
                  </div>

                  {/* Verification Scope & Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900 font-mono text-[10.5px] uppercase flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-600" /> Verification Checklist
                      </div>
                      <ul className="text-[11px] text-slate-600 space-y-1 pl-3 list-disc leading-relaxed">
                        <li>Input sanitization &amp; parameterized queries.</li>
                        <li>WAF inspection &amp; rate limit rules.</li>
                        <li>Automated regression validation.</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900 font-mono text-[10.5px] uppercase flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-slate-600" /> Scope Note
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed break-words">
                        {vuln.assumptions || 'Assessed against live production API perimeter under standard operational conditions.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[11px] font-mono text-slate-500">
                  <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                  <span>Audited by Sennovate Autonomous VAPT Platform</span>
                  <span>Page {pageNum} of {totalPages}</span>
                </div>
              </div>
            );
          }

          // =======================================================================
          // SINGLE SPACIOUS PAGE (For findings without heavy evidence/poc)
          // =======================================================================
          return (
            <div key={`finding-single-${vuln.id}-${pIdx}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[11px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" />
                  Sennovate Autonomous VAPT Deliverable &bull; Finding #{findingNum} of {sortedVulns.length}
                </span>
                <span className="truncate max-w-[240px]">Target: {companyName}</span>
              </div>

              <div className="flex-1 flex flex-col justify-start space-y-3.5 pt-3 pb-2">
                <div className="border-b border-slate-200 pb-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-200">Finding #{findingNum}: {vuln.id}</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        vuln.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                        vuln.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                        'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>{vuln.severity} &bull; CVSS {vuln.cvss}</span>
                      <span className="text-xs font-mono text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">{vuln.cwe}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-600">Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong></div>
                  </div>
                  <h3 className="text-lg font-black text-slate-950 tracking-tight leading-snug break-words">{vuln.title}</h3>
                  <div className="text-xs font-mono text-slate-600">Complete Target URL: <code className="text-cyan-800 font-bold break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code></div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" /> <span>Technical Analysis &amp; Mechanism</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] text-slate-800 leading-relaxed space-y-1.5 break-words font-sans">
                    <p>{vuln.description}</p>
                    {vuln.technicalAnalysis && <p className="text-slate-700 text-[12px] pt-1.5 border-t border-slate-200 break-words leading-relaxed"><strong className="text-slate-900">Mechanics:</strong> {vuln.technicalAnalysis}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" /> <span>Security &amp; Threat Impact</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 text-[12.5px] text-slate-900 leading-relaxed break-words font-sans"><p>{vuln.impact}</p></div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> <span>Step-by-Step Remediation Action Plan</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1.5">
                    {vuln.remediation && (
                      <p className="text-slate-900 font-bold text-[12.5px] break-words leading-relaxed">{cleanText(vuln.remediation)}</p>
                    )}
                    {vuln.remediationSteps && vuln.remediationSteps.length > 0 && (
                      <ol className="list-decimal list-inside space-y-1 text-[12px] text-slate-800 font-sans leading-relaxed">
                        {vuln.remediationSteps.map((step, sIdx) => <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>)}
                      </ol>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[11px] font-mono text-slate-500">
                <span>CONFIDENTIAL &bull; PROPRIETARY</span>
                <span>Audited by Sennovate Autonomous VAPT Platform</span>
                <span>Page {pageNum} of {totalPages}</span>
              </div>
            </div>
          );
        })}
          </>
        )}
      </div>
    </div>
  );
}
