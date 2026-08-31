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
  Info 
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
        <ul key={`list-${elements.length}`} className="space-y-1 pl-4 list-disc text-xs text-slate-700 font-sans">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed break-words">
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
        <h4 key={idx} className="text-xs font-bold text-slate-950 uppercase tracking-wide pt-1 font-mono break-words">
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
        <p key={idx} className="text-xs text-slate-700 leading-relaxed font-sans break-words">
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
  return <div className="space-y-2">{elements}</div>;
}

export default function PdfReport({ 
  vulnerabilities = [], 
  metadata = {}, 
  companyName = "Target Organization", 
  theme = 'dark' 
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [customAiSummary, setCustomAiSummary] = useState(null);

  // Group and sort vulnerabilities in strict priority order (Critical -> High -> Med -> Low)
  const sortedVulns = [...vulnerabilities].sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  const critVulns = sortedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const topVuln = sortedVulns[0] || null;

  const targetUrl = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target-system.internal");
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 6.8;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 8.5 ? 'CRITICAL' : (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED'));

  // Calculate total report pages dynamically
  const findingsCount = sortedVulns.length > 0 ? sortedVulns.length : 1;
  const totalPages = 3 + findingsCount;

  // Trigger Live LLM RAG Synthesis for Executive Summary
  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const prompt = `Generate a concise, crystal-clear, structured Executive Findings Summary for the VAPT report of ${companyName}.
Include:
1. Executive Risk Overview (2 paragraphs)
2. Ordered breakdown of findings categorized by severity.
3. Prioritized 3-Phase Action Roadmap (Immediate 24h, Short-term 7d, Medium-term 30d).`;

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
      await exportReportToPdf('vapt-pdf-report-root', `Sennovate_VAPT_Report_${sanitizedName}.pdf`);
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
      {/* Top Action Bar */}
      <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 no-print shadow-sm transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-cyan-600 dark:text-cyan-400 font-mono text-xs font-bold uppercase">
            <FileText className="w-4 h-4 text-cyan-500" />
            <span>Formal Enterprise VAPT Deliverable Report</span>
          </div>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Security Penetration Test Report for {companyName}
          </h2>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
            Multi-page structured assessment deliverable with executive threat posture, vulnerability matrix, and complete technical findings sheets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateAiSummary}
            disabled={isGeneratingAiSummary}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs font-sans transition-all border ${
              theme === 'dark'
                ? 'bg-[#0E172B] hover:bg-[#152342] text-cyan-300 border-cyan-800'
                : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300 shadow-sm'
            }`}
          >
            <Sparkles className={`w-4 h-4 text-cyan-500 ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
            <span>{isGeneratingAiSummary ? 'Synthesizing with LLM...' : 'Regenerate AI Summary'}</span>
          </button>

          <button
            onClick={handlePrint}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs font-sans transition-all border ${
              theme === 'dark'
                ? 'bg-[#080E1C] hover:bg-slate-800 text-slate-200 border-slate-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs font-sans transition-all shadow-md bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950"
          >
            {isExporting ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                <span>Compiling A4 PDF for {companyName}...</span>
              </>
            ) : exportSuccess ? (
              <>
                <Check className="w-4 h-4 text-slate-950" />
                <span>PDF Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>Download Official PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Embedded Print & Page Styling Rules */}
      <style>{`
        .pdf-page {
          width: 100%;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto 32px auto;
          background: #ffffff;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: visible !important;
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
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, nav, aside, header, footer, button, .chat-drawer {
            display: none !important;
          }
          #vapt-pdf-report-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .pdf-page {
            width: 210mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* Printable Document Root (Pre-Paginated Clean A4 Containers) */}
      <div id="vapt-pdf-report-root" className="space-y-8">

        {/* ========================================================================= */}
        {/* PAGE 1: EXECUTIVE COVER PAGE                                              */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[18mm_16mm_18mm_16mm] bg-white text-slate-900 border border-slate-200">
          {/* Cover Header */}
          <div className="flex items-center justify-between border-b pb-4 border-slate-200">
            <div className="flex items-center gap-3">
              <img
                src="/logo/Logo dark.jpg"
                alt="Sennovate Inc."
                className="h-8 object-contain"
              />
            </div>
            <div className="text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded inline-block text-[10px]">
                CONFIDENTIAL &bull; PROPRIETARY
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Doc Ref: {metadata.runId || 'VAPT-AUDIT-2026'}</div>
            </div>
          </div>

          {/* Cover Body */}
          <div className="space-y-5 my-auto py-4">
            <div className="inline-block px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-mono font-bold text-cyan-900 uppercase tracking-wider">
              {metadata.assessmentType || "External Web Application & API Penetration Test"}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">
                PREPARED EXCLUSIVELY FOR:
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight break-words">
                {companyName}
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-2xl leading-relaxed break-words">
              Comprehensive autonomous penetration test deliverable covering attack surface discovery, multi-stage vulnerability verification, and prioritized risk remediation roadmap.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">PRIMARY TARGET</span>
                <span className="font-bold text-slate-900 truncate block text-[11px]">{targetUrl}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">OVERALL RISK POSTURE</span>
                <span className="font-bold text-rose-700 text-[11px]">{overallRiskLevel} ({overallRiskScore}/10)</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">CONFIRMED FINDINGS</span>
                <span className="font-bold text-slate-900 text-[11px]">{sortedVulns.length} Verified</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">ASSESSMENT STATUS</span>
                <span className="font-bold text-emerald-700 text-[11px]">Audit Completed</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-600" />
                Assessment Frameworks &amp; Compliance Standards
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px] break-words">
                Executed in alignment with the <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>.
              </p>
            </div>
          </div>

          {/* Cover Footer */}
          <div>
            <div className="flex items-center justify-between border-t pt-3 border-slate-200 text-xs font-mono text-slate-600">
              <div>
                <strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}
              </div>
              <div>
                <strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-slate-400">
              <span>Confidential &bull; Sennovate Inc.</span>
              <span>Page 1 of {totalPages}</span>
            </div>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGE 2: EXECUTIVE SUMMARY & THREAT POSTURE & ROADMAP                      */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[18mm_16mm_18mm_16mm] bg-white text-slate-900 border border-slate-200">
          {/* Running Header */}
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-600" />
              Sennovate Autonomous VAPT Deliverable
            </span>
            <span className="truncate max-w-[200px]">Target: {companyName}</span>
          </div>

          {/* Page Body */}
          <div className="space-y-3.5 my-auto py-2">
            <div className="flex items-center justify-between border-b pb-2 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">
                1. Executive Summary &amp; Threat Posture
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900">
                VERIFIED FINDINGS
              </span>
            </div>

            {customAiSummary ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-800 leading-relaxed font-sans break-words">
                {renderFormattedMarkdown(customAiSummary)}
              </div>
            ) : (
              <>
                {/* Executive Assessment Overview */}
                <div className="space-y-1.5 text-xs text-slate-800 leading-relaxed font-sans break-words">
                  <p>
                    Sennovate Autonomous Security Engine conducted an external penetration testing assessment against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope covered the public digital perimeter, web applications, and integrated API endpoints.
                  </p>
                  <p>
                    The assessment identified <strong>{sortedVulns.length} confirmed security vulnerabilities</strong> ({critVulns.length > 0 ? `${critVulns.length} Critical, ` : ''}{highVulns.length} High Severity, {medVulns.length} Medium Severity).
                  </p>
                </div>

                {/* Top Risk Callout */}
                {topVuln && (
                  <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-1 text-xs">
                    <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-1.5 text-[11px]">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>Strategic Threat Assessment: {overallRiskLevel} Risk ({overallRiskScore}/10)</span>
                    </div>
                    <p className="leading-relaxed text-[11px] break-words">
                      The primary risk vector is <strong>{topVuln.title}</strong> on <code>{topVuln.target || topVuln.endpoint}</code> (CVSS {topVuln.cvss}). Exploitation could allow attackers: {topVuln.impact || topVuln.description}
                    </p>
                  </div>
                )}

                {/* Ordered Findings Breakdown */}
                <div className="space-y-2 pt-0.5">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">
                    Ordered Findings Breakdown for {companyName}
                  </h3>

                  <div className="space-y-2">
                    {highVulns.length > 0 && (
                      <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-rose-900 uppercase font-mono">
                            High Priority Security Risks ({highVulns.length} Finding{highVulns.length > 1 ? 's' : ''})
                          </span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                            Priority: Urgent
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 space-y-1 pl-2">
                          {highVulns.map(v => (
                            <div key={v.id} className="leading-tight break-words">
                              &bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss} {v.severity}) &mdash; <code className="text-cyan-800">{v.endpoint}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {medVulns.length > 0 && (
                      <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-900 uppercase font-mono">
                            Medium Priority Infrastructure &amp; Policy Findings ({medVulns.length} Finding{medVulns.length > 1 ? 's' : ''})
                          </span>
                          <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                            Priority: High
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 space-y-1 pl-2">
                          {medVulns.map(v => (
                            <div key={v.id} className="leading-tight break-words">
                              &bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss}) &mdash; <span className="text-slate-600">{v.description?.slice(0, 95)}...</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-Phase Remediation Roadmap */}
                <div className="space-y-1.5 pt-0.5">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">
                    Prioritized 3-Phase Remediation Roadmap
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-rose-700 font-mono text-[10px] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        Phase 1: Immediate (&lt; 24h)
                      </div>
                      <p className="text-slate-700 text-[10px] leading-relaxed break-words">
                        {topVuln ? `Remediate ${topVuln.title} on ${topVuln.endpoint}.` : 'Patch high priority vulnerabilities immediately.'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-amber-700 font-mono text-[10px] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        Phase 2: Short-Term (&lt; 7 Days)
                      </div>
                      <p className="text-slate-700 text-[10px] leading-relaxed break-words">
                        Address medium severity findings across {companyName} endpoints, implementing strict input validation and access controls.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-cyan-800 font-mono text-[10px] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        Phase 3: Strategic (&lt; 30 Days)
                      </div>
                      <p className="text-slate-700 text-[10px] leading-relaxed break-words">
                        Deploy strict Content-Security-Policy (CSP), review CORS headers, and conduct scheduled automated regression testing.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Running Footer */}
          <div className="flex items-center justify-between border-t pt-2.5 border-slate-200 text-[10px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 2 of {totalPages}</span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGE 3: VULNERABILITY SUMMARY MATRIX                                      */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[18mm_16mm_18mm_16mm] bg-white text-slate-900 border border-slate-200">
          {/* Running Header */}
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-600" />
              Sennovate Autonomous VAPT Deliverable
            </span>
            <span className="truncate max-w-[200px]">Target: {companyName}</span>
          </div>

          {/* Page Body */}
          <div className="space-y-4 my-auto py-2">
            <div className="flex items-center justify-between border-b pb-2 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">
                2. Vulnerability Summary Matrix
              </h2>
              <span className="text-xs font-mono text-slate-500 font-bold">{sortedVulns.length} Confirmed Findings</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-[10px] text-left table-fixed">
                <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-[10%]">ID</th>
                    <th className="p-2 w-[30%]">Vulnerability Title</th>
                    <th className="p-2 w-[14%]">Severity</th>
                    <th className="p-2 w-[9%]">CVSS</th>
                    <th className="p-2 w-[11%]">CWE</th>
                    <th className="p-2 w-[16%]">Target Endpoint</th>
                    <th className="p-2 w-[10%]">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVulns.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-cyan-800 break-words">{v.id}</td>
                      <td className="p-2 font-bold text-slate-900 break-words">{v.title}</td>
                      <td className="p-2 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          v.severity === 'CRITICAL' 
                            ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                            : v.severity === 'HIGH' 
                            ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="p-2 font-mono font-bold">{v.cvss}</td>
                      <td className="p-2 font-mono text-slate-600 break-words">{v.cwe}</td>
                      <td className="p-2 font-mono text-slate-600 break-all text-[9px]">{v.endpoint || v.target}</td>
                      <td className="p-2 font-mono font-bold text-slate-700">
                        {idx === 0 ? 'Urgent' : idx <= 2 ? 'High' : 'Medium'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Severity Rating Guide */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-[11px] uppercase tracking-wider">
                Industry Severity Scoring Guide (CVSS v3.1 Base Metrics)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded bg-red-50 border border-red-200">
                  <strong className="text-red-900 block">CRITICAL (9.0 - 10.0)</strong>
                  <span className="text-slate-600 break-words">Immediate compromise, RCE, or full system takeover.</span>
                </div>
                <div className="p-2 rounded bg-orange-50 border border-orange-200">
                  <strong className="text-orange-900 block">HIGH (7.0 - 8.9)</strong>
                  <span className="text-slate-600 break-words">Severe privilege escalation, data leak, or bypass.</span>
                </div>
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  <strong className="text-amber-900 block">MEDIUM (4.0 - 6.9)</strong>
                  <span className="text-slate-600 break-words">Partial data exposure, CSRF, or configuration flaw.</span>
                </div>
                <div className="p-2 rounded bg-slate-100 border border-slate-200">
                  <strong className="text-slate-900 block">LOW (0.1 - 3.9)</strong>
                  <span className="text-slate-600 break-words">Information disclosure or minor security hygiene issue.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Running Footer */}
          <div className="flex items-center justify-between border-t pt-2.5 border-slate-200 text-[10px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 3 of {totalPages}</span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGES 4 TO N: TECHNICAL VULNERABILITY FINDING SHEETS (1 Page per Finding) */}
        {/* ========================================================================= */}
        {sortedVulns.map((vuln, index) => {
          const pageNum = 4 + index;

          return (
            <div 
              key={vuln.id} 
              className="pdf-page p-[18mm_16mm_18mm_16mm] bg-white text-slate-900 border border-slate-200"
            >
              {/* Running Header */}
              <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-600" />
                  Sennovate Autonomous VAPT Deliverable &bull; Technical Finding Details
                </span>
                <span className="truncate max-w-[200px]">Target: {companyName}</span>
              </div>

              {/* Finding Content Container (Designed to fit cleanly in 1 A4 page) */}
              <div className="space-y-2.5 my-auto py-1.5">
                {/* 1. Header with Badges & Metadata */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="space-y-1 max-w-[70%]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-200">
                        Finding #{index + 1}: {vuln.id}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        vuln.severity === 'CRITICAL' 
                          ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                          : vuln.severity === 'HIGH' 
                          ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {vuln.severity} &bull; CVSS {vuln.cvss}
                      </span>
                      <span className="text-[10px] font-mono text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                        {vuln.cwe}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-950 tracking-tight leading-snug break-words">
                      {vuln.title}
                    </h3>
                  </div>

                  <div className="text-right text-[10px] font-mono text-slate-600 space-y-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 max-w-[28%]">
                    <div className="truncate">Target: <strong className="text-slate-900">{vuln.target?.slice(0, 30)}</strong></div>
                    <div className="truncate">Endpoint: <code className="text-cyan-800 font-bold">{vuln.endpoint}</code></div>
                    <div>Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong></div>
                  </div>
                </div>

                {/* 2. Description & Root Cause */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Info className="w-3 h-3 text-cyan-600 flex-shrink-0" />
                    <span>Technical Analysis &amp; Vulnerability Mechanism:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1 break-words">
                    <p className="break-words">{vuln.description}</p>
                    {vuln.technicalAnalysis && (
                      <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200 break-words">
                        <strong className="text-slate-800">Mechanics:</strong> {vuln.technicalAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Threat & Business Impact */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-600 flex-shrink-0" />
                    <span>Security &amp; Business Threat Impact:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50/40 border border-rose-200 text-xs text-slate-800 leading-relaxed break-words">
                    <p className="break-words">{vuln.impact}</p>
                  </div>
                </div>

                {/* 4. OBSERVED EVIDENCE (No scrollbars, fully wrapped) */}
                {vuln.evidence && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-slate-700 flex-shrink-0" />
                      <span>Observed Scan Evidence:</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] border border-slate-800 break-all overflow-visible">
                      <pre className="whitespace-pre-wrap leading-relaxed select-all break-all overflow-visible font-mono">
                        {vuln.evidence}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 5. PROOF OF CONCEPT & REPRODUCTION */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Code className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>Proof of Concept &amp; Exact Reproduction Steps:</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    {vuln.pocDescription && (
                      <div className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px] font-sans break-words">
                        {vuln.pocDescription}
                      </div>
                    )}

                    {(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                      <div className="p-2 rounded bg-slate-950 text-cyan-300 font-mono text-[10px] space-y-0.5 border border-slate-800 overflow-visible break-all">
                        <span className="text-[9px] uppercase text-slate-400 font-bold block font-mono">
                          Verification Command:
                        </span>
                        <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap font-mono">
                          {vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Remediation Action Plan */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>Step-by-Step Remediation Action Plan:</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs space-y-1 break-words">
                    {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                      <p className="text-slate-800 font-medium text-[11px] break-words">
                        {cleanText(vuln.remediation)}
                      </p>
                    )}

                    {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-700 font-sans">
                        {vuln.remediationSteps.map((step, sIdx) => (
                          <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>
                        ))}
                      </ol>
                    ) : (
                      !vuln.remediation && <p className="text-slate-500 italic text-[11px]">Apply standard security patches and configuration hardening.</p>
                    )}
                  </div>
                </div>

                {/* 7. Scope & Assumptions Note */}
                {vuln.assumptions && (
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200 break-words">
                    <strong>Scope Note:</strong> {vuln.assumptions}
                  </div>
                )}
              </div>

              {/* Running Footer */}
              <div className="flex items-center justify-between border-t pt-2.5 border-slate-200 text-[10px] font-mono text-slate-500">
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
