import React, { useState, useEffect } from 'react';
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
        <ul key={`list-${elements.length}`} className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-slate-700 font-sans">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
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

    // Heading 1, 2, 3 or bold headers
    if (/^#+\s+/.test(trimmed) || /^\*\*[0-9\.\s]*[A-Z\s:]+\*\*$/.test(trimmed)) {
      flushList();
      const headingClean = cleanText(trimmed);
      elements.push(
        <h4 key={idx} className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide pt-2 font-mono">
          {headingClean}
        </h4>
      );
    } else if (/^[\*\-\•]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[\*\-\•\d\.\)]+\s+/, '');
      const parts = itemContent.split(/(\*\*[^*]+\*\*)/g);
      currentList.push(
        <span>
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
        <p key={idx} className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
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
  return <div className="space-y-3">{elements}</div>;
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

  // Group and sort vulnerabilities in strict priority order (High -> Med -> Low)
  const sortedVulns = [...vulnerabilities].sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const topVuln = sortedVulns[0] || null;

  const targetUrl = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target.com");
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 8.2;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED');

  // Trigger Live LLM RAG Synthesis for Executive Summary
  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const prompt = `Generate a concise, crystal-clear, structured Executive Findings Summary for the VAPT report of ${companyName}.
Include:
1. Executive Risk Overview (2 paragraphs)
2. Ordered breakdown of findings categorized into 3 tiers: Authentication/Execution risks, API/Information disclosure, and Configuration/Network policy.
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
      const sanitizedName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      await exportReportToPdf('vapt-pdf-report-root', `Sennovate_VAPT_Report_${sanitizedName}.pdf`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export fallback:', err);
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
            <span>Formal VAPT Deliverable Report</span>
          </div>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Security Penetration Test Report for {companyName}
          </h2>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
            Prepared by Sennovate Inc. containing ordered findings summary &amp; full technical finding sheets with actual PoC evidence.
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
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs font-sans transition-all shadow-md bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950"
          >
            {isExporting ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                <span>Compiling PDF for {companyName}...</span>
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

      {/* Printable Document Root */}
      <div 
        id="vapt-pdf-report-root" 
        className="bg-white text-slate-900 font-sans p-8 sm:p-12 rounded-2xl shadow-xl space-y-12 max-w-5xl mx-auto border border-slate-300"
      >
        {/* COVER PAGE */}
        <div className="min-h-[840px] flex flex-col justify-between p-6 sm:p-10 border-b-2 border-slate-300">
          <div className="flex items-center justify-between border-b pb-6 border-slate-200">
            <div className="flex items-center gap-3">
              <img
                src="/logo/Logo dark.jpg"
                alt="Sennovate Inc."
                className="h-10 object-contain"
              />
            </div>

            <div className="text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded inline-block">
                CONFIDENTIAL &bull; PROPRIETARY
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Assessment Ref: {metadata.runId || 'VAPT-2026'}</div>
            </div>
          </div>

          <div className="space-y-6 my-auto py-12">
            <div className="inline-block px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-mono font-bold text-cyan-800 uppercase tracking-wider">
              {metadata.assessmentType || "External Web Application & API Penetration Test"}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-mono text-slate-500 font-bold uppercase tracking-widest">
                PREPARED EXCLUSIVELY FOR:
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-tight">
                {companyName}
              </h1>
            </div>

            <p className="text-base text-slate-700 font-medium max-w-2xl leading-relaxed">
              Comprehensive security posture audit, attack surface analysis, vulnerability validation, and prioritized remediation roadmap.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">PRIMARY TARGET</span>
                <span className="font-bold text-slate-900">{targetUrl}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">OVERALL RISK POSTURE</span>
                <span className="font-bold text-rose-700">{overallRiskLevel} ({overallRiskScore}/10)</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">TOTAL FINDINGS</span>
                <span className="font-bold text-slate-900">{sortedVulns.length} Confirmed</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block font-bold">ASSESSMENT DATE</span>
                <span className="font-bold text-slate-900">August 2026</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-6 border-slate-200 text-xs font-mono text-slate-600">
            <div>
              <strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Team"}
            </div>
            <div>
              <strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}
            </div>
          </div>
        </div>

        {/* SECTION 1: DYNAMIC EXECUTIVE SUMMARY */}
        <div className="space-y-6 pt-6 page-break">
          <div className="flex items-center justify-between border-b pb-3 border-slate-300">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                1. Executive Summary &amp; Threat Posture
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                VERIFIED FINDINGS
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500">Sennovate Deliverable</span>
          </div>

          {customAiSummary ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
              {renderFormattedMarkdown(customAiSummary)}
            </div>
          ) : (
            <>
              {/* Executive Assessment Overview */}
              <div className="space-y-3 text-sm text-slate-800 leading-relaxed font-sans">
                <p>
                  Sennovate Inc. performed an external autonomous security assessment and penetration test against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope covered the public digital footprint, active web endpoints, and supporting API services.
                </p>
                <p>
                  The testing confirmed <strong>{sortedVulns.length} verified security vulnerabilities</strong> across the target surface ({highVulns.length} High Severity, {medVulns.length} Medium Severity).
                </p>
              </div>

              {/* Top Risk Callout */}
              {topVuln && (
                <div className="p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Strategic Threat Assessment: {overallRiskLevel} Risk ({overallRiskScore}/10)</span>
                  </div>
                  <p className="leading-relaxed">
                    The primary risk vector is <strong>{topVuln.title}</strong> on <code>{topVuln.target || topVuln.endpoint}</code> (CVSS {topVuln.cvss}). An external attacker could leverage this vulnerability: {topVuln.impact || topVuln.description}
                  </p>
                </div>
              )}

              {/* DYNAMIC ORDERED FINDINGS BREAKDOWN */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-950 font-mono uppercase tracking-wider">
                  Ordered Findings Breakdown for {companyName}
                </h3>

                <div className="space-y-3">
                  {/* High Severity Tier */}
                  {highVulns.length > 0 && (
                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <h4 className="font-bold text-xs text-rose-900 uppercase font-mono">
                            High Priority Security Risks ({highVulns.length} Finding{highVulns.length > 1 ? 's' : ''})
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          Priority: Urgent
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 space-y-2 pl-4">
                        {highVulns.map(v => (
                          <div key={v.id} className="space-y-1 border-b border-rose-100 pb-2 last:border-b-0">
                            <div className="font-bold text-slate-900">
                              &bull; [{v.id}] {v.title} (CVSS {v.cvss} {v.severity}) &mdash; <code>{v.endpoint}</code>
                            </div>
                            <p className="text-slate-600 leading-relaxed text-[11px]">
                              <strong>Impact:</strong> {v.impact || v.description}
                            </p>
                            <p className="text-emerald-800 text-[11px] font-mono">
                              <strong>Remediation:</strong> {v.remediation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medium Severity Tier */}
                  {medVulns.length > 0 && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <h4 className="font-bold text-xs text-amber-900 uppercase font-mono">
                            Medium Priority Infrastructure &amp; Policy Findings ({medVulns.length} Finding{medVulns.length > 1 ? 's' : ''})
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Priority: High
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 space-y-2 pl-4">
                        {medVulns.map(v => (
                          <div key={v.id} className="space-y-0.5 border-b border-amber-100 pb-1.5 last:border-b-0">
                            <span className="font-bold text-slate-900">&bull; [{v.id}] {v.title} (CVSS {v.cvss}):</span>
                            <span className="text-slate-600 block text-[11px]">{v.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DYNAMIC 3-PHASE REMEDIATION ROADMAP */}
              <div className="space-y-3 pt-3">
                <h3 className="text-sm font-bold text-slate-950 font-mono uppercase tracking-wider">
                  Prioritized 3-Phase Remediation Roadmap
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="font-bold text-rose-700 font-mono text-[11px] uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Phase 1: Immediate (&lt; 24h)
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      {topVuln ? `Remediate ${topVuln.title} on ${topVuln.endpoint}. ${topVuln.remediation}` : 'Patch critical findings immediately.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="font-bold text-amber-700 font-mono text-[11px] uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Phase 2: Short-Term (&lt; 7 Days)
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      Address medium severity findings across {companyName} endpoints, implementing strict input validation and access controls.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="font-bold text-cyan-800 font-mono text-[11px] uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Phase 3: Strategic (&lt; 30 Days)
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      Deploy strict Content-Security-Policy (CSP), review CORS headers, and conduct scheduled automated regression testing.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* SECTION 2: VULNERABILITY SUMMARY MATRIX */}
        <div className="space-y-6 pt-6 page-break">
          <div className="flex items-center justify-between border-b pb-3 border-slate-300">
            <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
              2. Vulnerability Summary Matrix
            </h2>
            <span className="text-xs font-mono text-slate-500">{sortedVulns.length} Confirmed Findings</span>
          </div>

          <table className="w-full border border-slate-200 text-xs text-left">
            <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
              <tr>
                <th className="p-2.5">ID</th>
                <th className="p-2.5">Vulnerability Title</th>
                <th className="p-2.5">Severity</th>
                <th className="p-2.5">CVSS</th>
                <th className="p-2.5">CWE</th>
                <th className="p-2.5">Target Endpoint</th>
                <th className="p-2.5">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedVulns.map((v, idx) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono font-bold text-cyan-800">{v.id}</td>
                  <td className="p-2.5 font-bold text-slate-900">{v.title}</td>
                  <td className="p-2.5 font-mono">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      v.severity === 'CRITICAL' 
                        ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                        : v.severity === 'HIGH' 
                        ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono font-bold">{v.cvss}</td>
                  <td className="p-2.5 font-mono text-slate-600">{v.cwe}</td>
                  <td className="p-2.5 font-mono text-slate-600 truncate max-w-[160px]">{v.endpoint || v.target}</td>
                  <td className="p-2.5 font-mono font-bold text-slate-700">
                    {idx === 0 ? 'Urgent (P1)' : idx <= 2 ? 'High (P2)' : 'Medium (P3)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SECTION 3: COMPREHENSIVE TECHNICAL FINDING DETAILS */}
        <div className="space-y-10 pt-6">
          <div className="flex items-center justify-between border-b pb-3 border-slate-300">
            <div>
              <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                3. Comprehensive Technical Finding Details
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Technical analyses, observed evidence, and exact proof of concept reproduction scripts for {companyName}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Ordered by CVSS Severity</span>
          </div>

          {sortedVulns.map((vuln, index) => {
            const isHigh = vuln.severity === 'HIGH';

            return (
              <div 
                key={vuln.id} 
                className="space-y-5 p-6 sm:p-7 rounded-2xl bg-slate-50/70 border border-slate-200 page-break shadow-sm"
              >
                {/* 1. Header with Badges & Metadata */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded-lg border border-cyan-200">
                        Finding #{index + 1}: {vuln.id}
                      </span>
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg ${
                        vuln.severity === 'CRITICAL' 
                          ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                          : vuln.severity === 'HIGH' 
                          ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {vuln.severity} &bull; CVSS {vuln.cvss}
                      </span>
                      <span className="text-xs font-mono text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded-lg">
                        {vuln.cwe}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
                      {vuln.title}
                    </h3>
                  </div>

                  <div className="text-right text-xs font-mono text-slate-600 space-y-0.5 bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>Target: <strong className="text-slate-900">{vuln.target}</strong></div>
                    <div>Endpoint: <code className="text-cyan-800 font-bold">{vuln.endpoint}</code></div>
                    <div>Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong></div>
                  </div>
                </div>

                {/* 2. Summarized Description & Root Cause */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Technical Analysis &amp; Mechanism:</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
                    <p>{vuln.description}</p>
                    {vuln.technicalAnalysis && (
                      <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                        <strong className="text-slate-800">Mechanics:</strong> {vuln.technicalAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Summarized Threat & Business Impact */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Security &amp; Business Threat Impact:</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-200 text-xs text-slate-800 leading-relaxed">
                    <p>{vuln.impact}</p>
                  </div>
                </div>

                {/* 4. ACTUAL EXACT EVIDENCE */}
                {vuln.evidence && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-700" />
                      <span>Actual Observed Scan Evidence:</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      <pre className="whitespace-pre-wrap leading-relaxed select-all">
                        {vuln.evidence}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 5. ACTUAL EXACT PROOF OF CONCEPT & REPRODUCTION SCRIPTS */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Proof of Concept &amp; Exact Reproduction Steps:</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs">
                    {vuln.pocDescription && (
                      <div className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px] font-sans">
                        {vuln.pocDescription}
                      </div>
                    )}

                    {(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                      <div className="p-3 rounded-lg bg-slate-950 text-cyan-300 font-mono text-[11px] space-y-1.5 border border-slate-800">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">
                          Verification Command:
                        </span>
                        <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap">
                          {vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Remediation Action Plan */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Remediation Action Plan:</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2">
                    {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                      <p className="text-slate-800 font-medium">
                        {cleanText(vuln.remediation)}
                      </p>
                    )}

                    {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 font-sans">
                        {vuln.remediationSteps.map((step, sIdx) => (
                          <li key={sIdx} className="leading-relaxed">{cleanText(step)}</li>
                        ))}
                      </ol>
                    ) : (
                      !vuln.remediation && <p className="text-slate-500 italic">Apply standard security patches and configuration hardening.</p>
                    )}
                  </div>
                </div>

                {/* 7. Scope & Assumptions Note */}
                {vuln.assumptions && (
                  <div className="text-[11px] font-mono text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                    <strong>Environmental Note / Scope:</strong> {vuln.assumptions}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FOOTER OF DELIVERABLE */}
        <div className="border-t-2 border-slate-200 pt-6 text-center text-xs font-mono text-slate-500 space-y-1">
          <div>Report automatically generated by <strong>Sennovate Autonomous VAPT Platform</strong></div>
          <div>Confidential &copy; 2026 Sennovate Inc. All Rights Reserved.</div>
        </div>
      </div>
    </div>
  );
}
