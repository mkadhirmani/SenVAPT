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

  const sortedVulns = [...vulnerabilities].sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  const critVulns = sortedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const topVuln = sortedVulns[0] || null;

  const targetUrl = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target-system.internal");
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 6.8;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 8.5 ? 'CRITICAL' : (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED'));

  const totalPages = 3 + (sortedVulns.length > 0 ? sortedVulns.length : 1);

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
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-slate-900 border-slate-800 text-white shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Executive Penetration Testing Report
              <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                A4 Standard &bull; {totalPages} Pages
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Target: <span className="font-mono text-cyan-300">{targetUrl}</span> &bull; {sortedVulns.length} Confirmed Vulnerabilities
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            <span>{isExporting ? "Exporting Deliverable..." : exportSuccess ? "Report Downloaded!" : "Download Official PDF"}</span>
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
        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-3 border-slate-200">
            <div className="flex items-center gap-3">
              <img src="/logo/Logo dark.jpg" alt="Sennovate Inc." className="h-8 object-contain" />
            </div>
            <div className="text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-[10.5px]">CONFIDENTIAL &bull; PROPRIETARY</div>
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

            <div className="space-y-1.5">
              <div className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">PREPARED EXCLUSIVELY FOR:</div>
              <h1 className="text-3xl font-black text-slate-950 tracking-tight leading-tight break-words">{companyName}</h1>
              <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed break-words max-w-3xl">Comprehensive autonomous penetration testing deliverable detailing perimeter vulnerability reconnaissance, live exploit verification, attack chain mapping, and prioritized risk mitigation roadmap.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">PRIMARY TARGET URI</span>
                <span className="font-extrabold text-slate-900 truncate block text-[13px]">{targetUrl}</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">OVERALL RISK POSTURE</span>
                <span className="font-extrabold text-rose-700 text-[13px]">{overallRiskLevel} ({overallRiskScore}/10 CVSS)</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">CONFIRMED FINDINGS</span>
                <span className="font-extrabold text-slate-900 text-[13px]">{sortedVulns.length} Verified ({highVulns.length} High, {medVulns.length} Medium)</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider">ASSESSMENT PROFILE</span>
                <span className="font-extrabold text-slate-900 text-[13px]">Black-Box Autonomous Audit</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600" /> Target Scope &amp; Evaluated Digital Perimeter
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11.5px]">
                <div className="space-y-1 text-slate-700 leading-relaxed">
                  <div><strong>In-Scope Target:</strong> <code>{targetUrl}</code></div>
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

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-600" /> Assessment Frameworks &amp; Compliance Standards Alignment
              </div>
              <p className="text-slate-600 leading-relaxed text-[11.5px] break-words">Conducted in strict alignment with <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, <strong>CWE/SANS Top 25</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>. All observed attack paths were verified to ensure zero false positives.</p>
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

        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT Deliverable &bull; Executive Threat Assessment
            </span>
            <span className="truncate max-w-[240px]">Target: {companyName}</span>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">1. Executive Summary &amp; Threat Posture</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900">VERIFIED FINDINGS</span>
            </div>

            {customAiSummary ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[12px] text-slate-800 leading-relaxed font-sans break-words">{renderFormattedMarkdown(customAiSummary)}</div>
            ) : (
              <>
                <div className="space-y-2 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">
                  <p>Sennovate Autonomous Security Engine conducted an external penetration testing assessment against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope encompassed the external web perimeter, exposed application services, and integrated API endpoints.</p>
                  <p>The assessment identified <strong>{sortedVulns.length} confirmed security vulnerabilities</strong> ({critVulns.length > 0 ? `${critVulns.length} Critical, ` : ''}{highVulns.length} High Severity, {medVulns.length} Medium Severity). The overall cybersecurity posture is evaluated at <strong>{overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</strong>, requiring targeted remediation to safeguard corporate data assets.</p>
                </div>
                {topVuln && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-1 text-xs">
                    <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-1.5 text-xs">
                      <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" /> <span>Strategic Exposure Vector: {overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</span>
                    </div>
                    <p className="leading-relaxed text-[11.5px] break-words text-slate-700">Primary exposure vector is <strong>{topVuln.title}</strong> on <code>{topVuln.target || topVuln.endpoint}</code> (CVSS {topVuln.cvss}). Exploitation allows unauthorized adversaries: {topVuln.impact || topVuln.description}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">Categorized Risk Breakdown</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {highVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-rose-900 uppercase font-mono">High Risks ({highVulns.length})</span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">Urgent Action</span>
                        </div>
                        <div className="text-[11px] text-slate-700 space-y-1 pl-1">{highVulns.map(v => <div key={v.id} className="leading-snug break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                    {medVulns.length > 0 && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-900 uppercase font-mono">Medium Findings ({medVulns.length})</span>
                          <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">Remediate &lt; 7d</span>
                        </div>
                        <div className="text-[11px] text-slate-700 space-y-1 pl-1">{medVulns.map(v => <div key={v.id} className="leading-snug break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">2. Prioritized 3-Phase Remediation Roadmap</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                      <div className="font-bold text-rose-700 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 1 (&lt; 24h)</div>
                      <p className="text-slate-700 text-[11px] leading-snug break-words">{topVuln ? `Remediate ${topVuln.title} on ${topVuln.endpoint}.` : 'Patch high priority vulnerabilities.'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                      <div className="font-bold text-amber-700 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 2 (&lt; 7 Days)</div>
                      <p className="text-slate-700 text-[11px] leading-snug break-words">Address medium severity findings across {companyName} application endpoints.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1">
                      <div className="font-bold text-cyan-800 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 3 (&lt; 30 Days)</div>
                      <p className="text-slate-700 text-[11px] leading-snug break-words">Deploy strict CSP, review CORS policies, and conduct automated regression audits.</p>
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

        <div className="pdf-page bg-white text-slate-900 border border-slate-200">
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT Deliverable &bull; Vulnerability Matrix &amp; Severity Scoring
            </span>
            <span className="truncate max-w-[240px]">Target: {companyName}</span>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-mono">3. Vulnerability Summary Matrix</h2>
              <span className="text-xs font-mono text-slate-500 font-bold">{sortedVulns.length} Confirmed Findings</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left table-fixed">
                <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-[11%]">ID</th>
                    <th className="p-2.5 w-[33%]">Vulnerability Title</th>
                    <th className="p-2.5 w-[13%]">Severity</th>
                    <th className="p-2.5 w-[8%]">CVSS</th>
                    <th className="p-2.5 w-[11%]">CWE</th>
                    <th className="p-2.5 w-[15%]">Target Endpoint</th>
                    <th className="p-2.5 w-[9%]">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVulns.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-cyan-800 break-words">{v.id}</td>
                      <td className="p-2.5 font-bold text-slate-900 break-words text-[11px]">{v.title}</td>
                      <td className="p-2.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                          v.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                          v.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                          'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>{v.severity}</span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-[11.5px]">{v.cvss}</td>
                      <td className="p-2.5 font-mono text-slate-600 break-words text-[10px]">{v.cwe}</td>
                      <td className="p-2.5 font-mono text-slate-600 break-all text-[10px]">{v.endpoint || v.target}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-700 text-[10.5px]">{idx === 0 ? 'Urgent' : idx <= 2 ? 'High' : 'Medium'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider">Industry Severity Scoring Guide (CVSS v3.1 Base Metrics)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                  <strong className="text-red-900 block text-[10px]">CRITICAL (9.0 - 10.0)</strong>
                  <span className="text-slate-600 leading-snug break-words text-[10px]">Immediate compromise, RCE, or full takeover.</span>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                  <strong className="text-orange-900 block text-[10px]">HIGH (7.0 - 8.9)</strong>
                  <span className="text-slate-600 leading-snug break-words text-[10px]">Privilege escalation or severe data leak.</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <strong className="text-amber-900 block text-[10px]">MEDIUM (4.0 - 6.9)</strong>
                  <span className="text-slate-600 leading-snug break-words text-[10px]">Partial data exposure or configuration flaw.</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                  <strong className="text-slate-900 block text-[10px]">LOW (0.1 - 3.9)</strong>
                  <span className="text-slate-600 leading-snug break-words text-[10px]">Information disclosure or hygiene issue.</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" /> Autonomous Penetration Testing Safety Attestation
              </div>
              <p className="text-slate-600 leading-relaxed text-[11.5px] break-words">All identified vulnerability attack vectors have been empirically validated through non-destructive dynamic proof-of-concept tests. Testing was executed strictly within authorized target bounds without denial of service or disruption to operational availability.</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 3 of {totalPages}</span>
          </div>
        </div>

        {sortedVulns.map((vuln, vIdx) => {
          const findingNum = vIdx + 1;
          const pageNum = 4 + vIdx;
          return (
            <div key={`finding-advisory-page-${vuln.id}-${vIdx}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[10.5px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" /> Sennovate Autonomous VAPT Deliverable &bull; Finding #{findingNum} of {sortedVulns.length}
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
                  <div className="text-xs font-mono text-slate-600">Target Endpoint: <code className="text-cyan-800 font-bold">{vuln.endpoint || vuln.target}</code></div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" /> <span>Technical Analysis &amp; Mechanism</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 leading-relaxed space-y-1.5 break-words font-sans">
                    <p>{vuln.description}</p>
                    {vuln.technicalAnalysis && <p className="text-slate-600 text-[11.5px] pt-1 border-t border-slate-200 break-words"><strong className="text-slate-800">Mechanics:</strong> {vuln.technicalAnalysis}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" /> <span>Security &amp; Threat Impact</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-[12px] text-slate-900 leading-relaxed break-words font-sans"><p>{vuln.impact}</p></div>
                </div>

                {(vuln.evidence || vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python || vuln.pocDescription) && (
                  <div className="space-y-1">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> <span>Proof of Concept &amp; Live Verification</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      {vuln.pocDescription && <div className="text-slate-700 leading-relaxed whitespace-pre-line text-[11.5px] font-sans break-words">{vuln.pocDescription}</div>}
                      {(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                        <div className="p-2 rounded-lg bg-slate-950 text-cyan-300 font-mono text-[11px] space-y-0.5 border border-slate-800 overflow-visible break-all">
                          <span className="text-[9.5px] uppercase text-slate-400 font-bold block font-mono">Verification Command / Exploit:</span>
                          <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap font-mono">{vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> <span>Step-by-Step Remediation Action Plan</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1.5">
                    {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                      <p className="text-slate-900 font-semibold text-[12px] break-words">{cleanText(vuln.remediation)}</p>
                    )}
                    {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-800 font-sans">{vuln.remediationSteps.map((step, sIdx) => <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>)}</ol>
                    ) : !vuln.remediation && <p className="text-slate-500 italic text-[11px]">Apply standard security patches and configuration hardening.</p>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
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
