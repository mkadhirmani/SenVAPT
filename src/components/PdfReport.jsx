import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import { exportReportToPdf, exportReportToHtml, printIsolatedReport, generateReportMarkdown } from '../utils/pdfExport';
import { askLlmWithRag } from '../utils/llmEngine';
import { sortVulnerabilities, computeOverallRisk } from '../utils/severityUtils';
import { buildReportHtml } from '../utils/reportBuilder';
import { extractDomainInfo, sanitizeCompanyName, getDisplayDomain } from '../utils/domainUtils';

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

  const rawTarget = metadata.targetUrl || (() => {
    try { return sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : ''; } catch (_) { return ''; }
  })() || "https://target-system.internal";
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
  const overallRisk = useMemo(() => computeOverallRisk(sortedVulns), [sortedVulns]);

  const evaluatedTargets = useMemo(() => {
    return Array.from(new Set([
      ...(metadata.testedSubdomains || metadata.subdomains || []).map(s => typeof s === 'string' ? s : (s?.name || '')),
      ...sortedVulns.map(v => {
        try {
          const u = v.target ? (v.target.startsWith('http') ? v.target : `https://${v.target}`) : '';
          return u ? new URL(u).hostname : null;
        } catch (_) { return null; }
      }).filter(Boolean),
      (() => { try { return targetUrl ? new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname : null; } catch (_) { return null; } })()
    ].filter(Boolean)));
  }, [metadata, sortedVulns, targetUrl]);

  // Single source of truth: the self-paginating A4 report document
  const reportHtml = useMemo(() => buildReportHtml({
    vulnerabilities: sortedVulns,
    metadata,
    companyName: displayCompanyName,
    targetDomain: displayTargetDomain,
    targetUrl,
    reportType,
    executiveSummary: customAiSummary,
    evaluatedTargets
  }), [sortedVulns, metadata, displayCompanyName, displayTargetDomain, targetUrl, reportType, customAiSummary, evaluatedTargets]);

  const iframeRef = useRef(null);
  const [previewHeight, setPreviewHeight] = useState(1200);
  const [previewReady, setPreviewReady] = useState(false);
  const [totalPages, setTotalPages] = useState(null);

  const syncPreviewSize = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const root = doc.documentElement;
      if (root.getAttribute('data-paginated')) {
        setPreviewHeight(root.scrollHeight + 8);
        setTotalPages(parseInt(root.getAttribute('data-total-pages') || '0', 10) || null);
        setPreviewReady(true);
      }
    } catch (_) { /* cross-origin guard */ }
  }, []);

  useEffect(() => { setPreviewReady(false); setTotalPages(null); }, [reportHtml]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data?.type === 'sennovate-report-ready' && iframeRef.current && e.source === iframeRef.current.contentWindow) {
        setPreviewHeight((e.data.height || 1200) + 8);
        setTotalPages(e.data.pages || null);
        setPreviewReady(true);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const reportFileBase = `Sennovate_VAPT_${reportType === 'simple' ? 'Summary' : 'Detailed'}_Report_${(displayCompanyName || displayTargetDomain || 'Target').replace(/[^a-zA-Z0-9]+/g, '_')}`;

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const prompt = `You are a Principal Security Consultant creating an executive penetration testing deliverable for ${displayCompanyName} (Target Domain: ${displayTargetDomain}, Primary Target: ${targetUrl}).
Write a professional, concise Executive Summary for a formal A4 penetration testing report (plain business language, no marketing tone). The overall risk score is ${overallRisk.score.toFixed(1)}/10 (${overallRisk.level}), calculated across all findings:
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
      const mode = await exportReportToPdf(reportHtml, `${reportFileBase}.pdf`);
      setExportSuccess(mode === 'pdf');
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    printIsolatedReport(reportHtml);
  };

  const handleExportHtml = () => {
    try {
      exportReportToHtml(reportHtml, `${reportFileBase}.html`);
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
                A4 &bull; {reportType === 'simple' ? 'Summary' : 'Detailed'} &bull; {totalPages ? `${totalPages} Pages` : 'Paginating…'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Target: <span className="font-mono text-[#80B7F1]">{displayCompanyName} ({displayTargetDomain})</span> &bull; {sortedVulns.length} Findings &bull; Overall Risk {overallRisk.score.toFixed(1)}/10 ({overallRisk.level})
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
              <span>Summary Report</span>
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

      {/* A4 report preview — the exact document that is exported to PDF */}
      <div className={`rounded-2xl border overflow-x-auto ${theme === 'dark' ? 'border-[#0A3778] bg-[#001127]' : 'border-slate-200 bg-[#E9EDF3]'}`}>
        {!previewReady && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006FE3]" />
            <span>Laying out A4 pages…</span>
          </div>
        )}
        <iframe
          key={reportHtml.length + reportType}
          ref={iframeRef}
          title="Sennovate VAPT report preview"
          srcDoc={reportHtml}
          onLoad={syncPreviewSize}
          style={{ width: '100%', minWidth: '230mm', height: previewHeight, border: 0, display: 'block', background: 'transparent' }}
        />
      </div>
    </div>
  );
}
