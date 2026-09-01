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

// Compact height estimators for optimal page packing
function estimateTextHeight(text, baseHeight = 20) {
  if (!text) return 0;
  const lines = Math.ceil(text.length / 85);
  return baseHeight + (lines * 14);
}

function estimateCodeHeight(code, baseHeight = 25) {
  if (!code) return 0;
  const lines = (code.match(/\n/g) || []).length + 1;
  return baseHeight + (lines * 13);
}

function estimateListHeight(steps, baseHeight = 20) {
  if (!steps || !steps.length) return baseHeight;
  return baseHeight + (steps.length * 18);
}

// Smart Logical Grouping: Prevents orphan headers, ensures natural continuation, and maximizes usable A4 page density
function packFindingPages(sortedVulns) {
  // Target usable height per A4 page (~960px at standard 96 DPI with 10mm top/bottom padding)
  const MAX_PAGE_HEIGHT = 960;
  const pages = [];
  let currentPageBlocks = [];
  let currentHeight = 0;

  sortedVulns.forEach((vuln, vIdx) => {
    const findingNum = vIdx + 1;

    // Unit 1: Assessment Unit (Header + Technical Analysis + Security Impact)
    // CRITICAL: Header and Technical Analysis are strictly kept together so headings never appear alone!
    const descLines = Math.ceil((vuln.description || '').length / 90);
    const techLines = Math.ceil((vuln.technicalAnalysis || '').length / 90);
    const impactLines = Math.ceil((vuln.impact || '').length / 90);
    const unit1Height = 55 + (descLines * 13) + (techLines ? techLines * 12 + 15 : 0) + (impactLines * 13 + 20);

    const unit1Blocks = [
      { type: 'header', height: 55, vuln, findingNum },
      { type: 'analysis', height: (descLines * 13) + (techLines ? techLines * 12 + 15 : 0), vuln, findingNum },
      { type: 'impact', height: (impactLines * 13 + 20), vuln, findingNum }
    ];

    // Unit 2: Verification & Evidence Unit (Observed Evidence + Proof of Concept Exploit)
    const evLines = vuln.evidence ? (vuln.evidence.match(/\n/g) || []).length + 1 : 0;
    const pocLines = (vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) 
      ? ((vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python).match(/\n/g) || []).length + 1 
      : 0;
    const evHeight = vuln.evidence ? Math.min(160, 25 + evLines * 11) : 0;
    const pocDescLines = Math.ceil((vuln.pocDescription || '').length / 90);
    const pocHeight = (pocDescLines ? pocDescLines * 12 : 0) + (pocLines ? Math.min(110, 25 + pocLines * 11) : 0) + 15;
    const unit2Height = evHeight + pocHeight;

    const unit2Blocks = [];
    if (vuln.evidence) {
      unit2Blocks.push({ type: 'evidence', height: evHeight, vuln, findingNum });
    }
    unit2Blocks.push({ type: 'poc', height: pocHeight, vuln, findingNum });

    // Unit 3: Remediation & Scope Unit (Action Plan + Scope Note)
    const remStepsCount = vuln.remediationSteps?.length || (vuln.remediation ? 2 : 1);
    const remHeight = 25 + (remStepsCount * 14);
    const scopeHeight = 45;
    const unit3Height = remHeight + scopeHeight;

    const unit3Blocks = [
      { type: 'remediation', height: remHeight, vuln, findingNum },
      { type: 'scope', height: scopeHeight, vuln, findingNum }
    ];

    const totalFindingHeight = unit1Height + unit2Height + unit3Height;

    // Case 1: Entire finding fits on current page cleanly
    if (currentHeight + totalFindingHeight <= MAX_PAGE_HEIGHT) {
      currentPageBlocks.push(...unit1Blocks, ...unit2Blocks, ...unit3Blocks);
      currentHeight += totalFindingHeight + 16;
      return;
    }

    // Case 2: Finding doesn't fit completely.
    // If the current page already has substantial content (over 560px), start this finding fresh at top of next page
    if (currentHeight > 560) {
      if (currentPageBlocks.length > 0) {
        pages.push({ blocks: currentPageBlocks });
      }
      currentPageBlocks = [];
      currentHeight = 0;
    }

    // Check if Unit 1 + Unit 2 fit together on current page
    if (currentHeight + unit1Height + unit2Height <= MAX_PAGE_HEIGHT) {
      currentPageBlocks.push(...unit1Blocks, ...unit2Blocks);
      pages.push({ blocks: currentPageBlocks });
      
      // Unit 3 (Remediation) naturally continues on next page with a clean continuation banner
      currentPageBlocks = [
        { type: 'continuation_header', height: 28, vuln, findingNum, subtitle: 'Remediation Plan & Scope' },
        ...unit3Blocks
      ];
      currentHeight = 28 + unit3Height + 16;
      return;
    }

    // If only Unit 1 fits on current page (with ample room to prevent awkward cutoff)
    if (currentHeight + unit1Height <= MAX_PAGE_HEIGHT && (MAX_PAGE_HEIGHT - currentHeight) >= unit1Height) {
      currentPageBlocks.push(...unit1Blocks);
      pages.push({ blocks: currentPageBlocks });

      // Unit 2 + Unit 3 naturally continue on next page
      currentPageBlocks = [
        { type: 'continuation_header', height: 28, vuln, findingNum, subtitle: 'Verification & Remediation Plan' },
        ...unit2Blocks,
        ...unit3Blocks
      ];
      currentHeight = 28 + unit2Height + unit3Height + 16;
      return;
    }

    // Otherwise, push current page and start fresh finding at top of new page
    if (currentPageBlocks.length > 0) {
      pages.push({ blocks: currentPageBlocks });
    }
    currentPageBlocks = [...unit1Blocks, ...unit2Blocks, ...unit3Blocks];
    currentHeight = totalFindingHeight + 16;
  });

  if (currentPageBlocks.length > 0) {
    pages.push({ blocks: currentPageBlocks });
  }

  return pages;
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

  // Pack dynamic continuous finding pages with zero block-splitting and optimal space density
  const dynamicFindingPages = packFindingPages(sortedVulns);
  const totalPages = 3 + (dynamicFindingPages.length > 0 ? dynamicFindingPages.length : 1);

  // Trigger Live LLM RAG Synthesis for Executive Summary & Alignment
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

  // Helper to render an atomic finding block in high-density compact format
  const renderFindingBlock = (block, bIdx) => {
    const { vuln, findingNum } = block;

    switch (block.type) {
      case 'continuation_header':
        return (
          <div key={`cont-${findingNum}-${bIdx}`} className="flex items-center justify-between p-2 rounded-lg bg-cyan-50/70 border border-cyan-200 text-[10px] font-mono pdf-block">
            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
              <span className="font-bold text-cyan-900 bg-cyan-200/70 px-1.5 py-0.5 rounded text-[8.5px] uppercase">
                {block.subtitle || 'Continued'}
              </span>
              <span className="font-bold text-slate-900 truncate">
                Finding #{findingNum} [{vuln.id}] &mdash; {vuln.title}
              </span>
            </div>
            <span className="font-mono font-bold text-slate-600 text-[9px] truncate">
              Endpoint: <code className="text-cyan-800 font-bold">{vuln.endpoint || vuln.target}</code>
            </span>
          </div>
        );

      case 'header':
        return (
          <div key={`hdr-${findingNum}-${bIdx}`} className="flex flex-wrap items-start justify-between gap-1.5 border-b border-slate-200 pb-1.5 pt-0.5 pdf-block">
            <div className="space-y-0.5 max-w-[72%]">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-mono font-bold text-cyan-900 bg-cyan-100 px-1.5 py-0.5 rounded border border-cyan-200">
                  Finding #{findingNum}: {vuln.id}
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  vuln.severity === 'CRITICAL' 
                    ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                    : vuln.severity === 'HIGH' 
                    ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {vuln.severity} &bull; CVSS {vuln.cvss}
                </span>
                <span className="text-[9px] font-mono text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded">
                  {vuln.cwe}
                </span>
              </div>

              <h3 className="text-xs font-extrabold text-slate-950 tracking-tight leading-snug break-words">
                {vuln.title}
              </h3>
            </div>

            <div className="text-right text-[9px] font-mono text-slate-600 space-y-0.5 bg-slate-50 p-1 rounded border border-slate-200 max-w-[26%]">
              <div className="truncate">Target: <strong className="text-slate-900">{vuln.target?.slice(0, 26)}</strong></div>
              <div className="truncate">Endpoint: <code className="text-cyan-800 font-bold">{vuln.endpoint}</code></div>
              <div>Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong></div>
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div key={`anl-${findingNum}-${bIdx}`} className="space-y-0.5">
            <div className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-600 flex-shrink-0" />
              <span>Technical Analysis &amp; Mechanism:</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] text-slate-700 leading-snug space-y-1 break-words font-sans">
              <p className="break-words">{vuln.description}</p>
              {vuln.technicalAnalysis && (
                <p className="text-slate-600 text-[10px] pt-0.5 border-t border-slate-200 break-words">
                  <strong className="text-slate-800">Mechanics:</strong> {vuln.technicalAnalysis}
                </p>
              )}
            </div>
          </div>
        );

      case 'impact':
        return (
          <div key={`imp-${findingNum}-${bIdx}`} className="space-y-0.5">
            <div className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-600 flex-shrink-0" />
              <span>Security &amp; Threat Impact:</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-200 text-[10.5px] text-slate-800 leading-snug break-words font-sans">
              <p className="break-words">{vuln.impact}</p>
            </div>
          </div>
        );

      case 'evidence':
        return (
          <div key={`evd-${findingNum}-${bIdx}`} className="space-y-0.5">
            <div className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-slate-700 flex-shrink-0" />
              <span>Observed Evidence (Protocol Response):</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 text-slate-100 font-mono text-[9.5px] border border-slate-800 break-all overflow-visible">
              <pre className="whitespace-pre-wrap leading-tight select-all break-all overflow-visible font-mono">
                {vuln.evidence}
              </pre>
            </div>
          </div>
        );

      case 'poc':
        return (
          <div key={`poc-${findingNum}-${bIdx}`} className="space-y-0.5">
            <div className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Code className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>Proof of Concept &amp; Verification:</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[10.5px]">
              {vuln.pocDescription && (
                <div className="text-slate-700 leading-snug whitespace-pre-line text-[10px] font-sans break-words">
                  {vuln.pocDescription}
                </div>
              )}

              {(vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python) && (
                <div className="p-1.5 rounded bg-slate-950 text-cyan-300 font-mono text-[9.5px] space-y-0.5 border border-slate-800 overflow-visible break-all">
                  <span className="text-[8.5px] uppercase text-slate-400 font-bold block font-mono">
                    Verification Exploit / Command:
                  </span>
                  <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap font-mono">
                    {vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python}
                  </code>
                </div>
              )}
            </div>
          </div>
        );

      case 'remediation':
        return (
          <div key={`rem-${findingNum}-${bIdx}`} className="space-y-0.5">
            <div className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>Step-by-Step Remediation Action Plan:</span>
            </div>

            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 text-[10.5px] space-y-1">
              {vuln.remediation && (!vuln.remediationSteps || vuln.remediationSteps.length === 0 || (!vuln.remediation.includes(vuln.remediationSteps[0]) && vuln.remediation !== vuln.remediationSteps[0])) && (
                <p className="text-slate-900 font-semibold text-[10.5px] break-words">
                  {cleanText(vuln.remediation)}
                </p>
              )}

              {vuln.remediationSteps && vuln.remediationSteps.length > 0 ? (
                <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-800 font-sans">
                  {vuln.remediationSteps.map((step, sIdx) => (
                    <li key={sIdx} className="leading-snug break-words">{cleanText(step)}</li>
                  ))}
                </ol>
              ) : (
                !vuln.remediation && <p className="text-slate-500 italic text-[10px]">Apply standard security patches and configuration hardening.</p>
              )}
            </div>
          </div>
        );

      case 'scope':
        return (
          <div key={`scp-${findingNum}-${bIdx}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
              <div className="font-bold text-slate-900 font-mono text-[9px] uppercase flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-cyan-600" />
                Verification Checklist
              </div>
              <ul className="text-[9.5px] text-slate-600 space-y-0.5 pl-3 list-disc">
                <li>Input sanitization &amp; parameterized queries.</li>
                <li>WAF inspection &amp; rate limit rules.</li>
                <li>Automated regression validation.</li>
              </ul>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
              <div className="font-bold text-slate-900 font-mono text-[9px] uppercase flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-600" />
                Scope Note
              </div>
              <p className="text-[9.5px] text-slate-600 leading-snug break-words">
                {vuln.assumptions || 'Assessed against live production API perimeter under standard operational conditions.'}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
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
            Space-optimized multi-page structured deliverable with executive threat posture, vulnerability matrix, and complete technical findings.
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
          width: 210mm;
          min-width: 210mm;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px auto;
          padding: 10mm 12mm 10mm 12mm;
          background: #ffffff;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);
          border-radius: 3px;
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
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .pdf-page {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            padding: 10mm 12mm 10mm 12mm !important;
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

      {/* Printable Document Root (High-Density Space-Optimized A4 Pages) */}
      <div id="vapt-pdf-report-root" className="space-y-8 flex flex-col items-center">

        {/* ========================================================================= */}
        {/* PAGE 1: EXECUTIVE COVER PAGE                                              */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[10mm_12mm_10mm_12mm] bg-white text-slate-900 border border-slate-200">
          {/* Cover Header */}
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-200">
            <div className="flex items-center gap-3">
              <img
                src="/logo/Logo dark.jpg"
                alt="Sennovate Inc."
                className="h-8 object-contain"
              />
            </div>
            <div className="text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2 py-0.5 rounded inline-block text-[9px]">
                CONFIDENTIAL &bull; PROPRIETARY
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Doc Ref: {metadata.runId || 'VAPT-AUDIT-2026'}</div>
            </div>
          </div>

          {/* Cover Body: Starts at top and naturally flows without artificial centering */}
          <div className="flex-1 flex flex-col justify-start space-y-4 pt-4 pb-2">
            <div className="inline-block px-2.5 py-0.5 bg-cyan-50 border border-cyan-200 rounded-md text-[10px] font-mono font-bold text-cyan-900 uppercase tracking-wider">
              {metadata.assessmentType || "External Web Application & API Penetration Test"}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                PREPARED EXCLUSIVELY FOR:
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight break-words">
                {companyName}
              </h1>
            </div>

            <p className="text-xs text-slate-700 font-medium max-w-2xl leading-relaxed break-words">
              Comprehensive autonomous penetration test deliverable covering attack surface discovery, multi-stage vulnerability verification, and prioritized risk remediation roadmap.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[9px] block font-bold">PRIMARY TARGET</span>
                <span className="font-bold text-slate-900 truncate block text-[10px]">{targetUrl}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] block font-bold">OVERALL RISK POSTURE</span>
                <span className="font-bold text-rose-700 text-[10px]">{overallRiskLevel} ({overallRiskScore}/10)</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] block font-bold">CONFIRMED FINDINGS</span>
                <span className="font-bold text-slate-900 text-[10px]">{sortedVulns.length} Verified</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] block font-bold">ASSESSMENT STATUS</span>
                <span className="font-bold text-emerald-700 text-[10px]">Audit Completed</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[9.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-600" />
                Assessment Frameworks &amp; Compliance Standards
              </div>
              <p className="text-slate-600 leading-relaxed text-[10px] break-words">
                Executed in alignment with the <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>.
              </p>
            </div>
          </div>

          {/* Cover Footer Anchored to bottom */}
          <div className="mt-auto">
            <div className="flex items-center justify-between border-t pt-2 border-slate-200 text-xs font-mono text-slate-600">
              <div>
                <strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}
              </div>
              <div>
                <strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 text-[9px] font-mono text-slate-400">
              <span>Confidential &bull; Sennovate Inc.</span>
              <span>Page 1 of {totalPages}</span>
            </div>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGE 2: EXECUTIVE SUMMARY, THREAT POSTURE & 3-PHASE ROADMAP               */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[10mm_12mm_10mm_12mm] bg-white text-slate-900 border border-slate-200">
          {/* Running Header */}
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[9.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-600" />
              Sennovate Autonomous VAPT Deliverable &bull; Executive Threat Assessment
            </span>
            <span className="truncate max-w-[200px]">Target: {companyName}</span>
          </div>

          {/* Page Body: Content begins under header and flows down naturally */}
          <div className="flex-1 flex flex-col justify-start space-y-3 pt-2 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-tight font-mono">
                1. Executive Summary &amp; Threat Posture
              </h2>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900">
                VERIFIED FINDINGS
              </span>
            </div>

            {customAiSummary ? (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[10.5px] text-slate-800 leading-snug font-sans break-words">
                {renderFormattedMarkdown(customAiSummary)}
              </div>
            ) : (
              <>
                {/* Executive Assessment Overview */}
                <div className="space-y-1 text-[10.5px] text-slate-800 leading-snug font-sans break-words">
                  <p>
                    Sennovate Autonomous Security Engine conducted an external penetration testing assessment against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope covered the public digital perimeter, web applications, and integrated API endpoints.
                  </p>
                  <p>
                    The assessment identified <strong>{sortedVulns.length} confirmed security vulnerabilities</strong> ({critVulns.length > 0 ? `${critVulns.length} Critical, ` : ''}{highVulns.length} High Severity, {medVulns.length} Medium Severity).
                  </p>
                </div>

                {/* Top Risk Callout */}
                {topVuln && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-0.5 text-[10.5px]">
                    <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-1 text-[10px]">
                      <ShieldAlert className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span>Strategic Threat: {overallRiskLevel} Risk ({overallRiskScore}/10)</span>
                    </div>
                    <p className="leading-snug text-[10px] break-words">
                      Primary vector is <strong>{topVuln.title}</strong> on <code>{topVuln.target || topVuln.endpoint}</code> (CVSS {topVuln.cvss}). Exploitation could allow attackers: {topVuln.impact || topVuln.description}
                    </p>
                  </div>
                )}

                {/* Ordered Findings Breakdown */}
                <div className="space-y-1 pt-0.5">
                  <h3 className="text-[10px] font-bold text-slate-950 font-mono uppercase tracking-wider">
                    Ordered Findings Breakdown
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {highVulns.length > 0 && (
                      <div className="p-2 rounded-lg border border-rose-200 bg-rose-50/50 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-rose-900 uppercase font-mono">
                            High Risks ({highVulns.length})
                          </span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[8.5px]">
                            Urgent
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-700 space-y-0.5 pl-1.5">
                          {highVulns.map(v => (
                            <div key={v.id} className="leading-tight break-words">
                              &bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {medVulns.length > 0 && (
                      <div className="p-2 rounded-lg border border-amber-200 bg-amber-50/40 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-amber-900 uppercase font-mono">
                            Medium Findings ({medVulns.length})
                          </span>
                          <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[8.5px]">
                            High
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-700 space-y-0.5 pl-1.5">
                          {medVulns.map(v => (
                            <div key={v.id} className="leading-tight break-words">
                              &bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-Phase Action Roadmap on same page */}
                <div className="space-y-1.5 pt-1">
                  <h3 className="text-[10px] font-bold text-slate-950 font-mono uppercase tracking-wider">
                    2. Prioritized 3-Phase Remediation Roadmap
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 space-y-0.5">
                      <div className="font-bold text-rose-700 font-mono text-[9px] uppercase flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                        Phase 1 (&lt; 24h)
                      </div>
                      <p className="text-slate-700 text-[9.5px] leading-tight break-words">
                        {topVuln ? `Remediate ${topVuln.title} on ${topVuln.endpoint}.` : 'Patch high priority vulnerabilities.'}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-0.5">
                      <div className="font-bold text-amber-700 font-mono text-[9px] uppercase flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                        Phase 2 (&lt; 7 Days)
                      </div>
                      <p className="text-slate-700 text-[9.5px] leading-tight break-words">
                        Address medium severity findings across {companyName} endpoints.
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 space-y-0.5">
                      <div className="font-bold text-cyan-800 font-mono text-[9px] uppercase flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                        Phase 3 (&lt; 30 Days)
                      </div>
                      <p className="text-slate-700 text-[9.5px] leading-tight break-words">
                        Deploy strict CSP, review CORS, and conduct automated regression audits.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Running Footer Anchored cleanly to bottom */}
          <div className="flex items-center justify-between border-t pt-2 mt-auto border-slate-200 text-[9.5px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 2 of {totalPages}</span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGE 3: VULNERABILITY SUMMARY MATRIX & CVSS RATING GUIDE                  */}
        {/* ========================================================================= */}
        <div className="pdf-page p-[10mm_12mm_10mm_12mm] bg-white text-slate-900 border border-slate-200">
          {/* Running Header */}
          <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[9.5px] font-mono text-slate-500 uppercase">
            <span className="font-bold text-cyan-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-600" />
              Sennovate Autonomous VAPT Deliverable &bull; Vulnerability Matrix
            </span>
            <span className="truncate max-w-[200px]">Target: {companyName}</span>
          </div>

          {/* Page Body: Content begins under header and flows down naturally */}
          <div className="flex-1 flex flex-col justify-start space-y-3 pt-2 pb-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-tight font-mono">
                3. Vulnerability Summary Matrix
              </h2>
              <span className="text-[10px] font-mono text-slate-500 font-bold">{sortedVulns.length} Confirmed Findings</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-[9.5px] text-left table-fixed">
                <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-1.5 w-[10%]">ID</th>
                    <th className="p-1.5 w-[30%]">Vulnerability Title</th>
                    <th className="p-1.5 w-[14%]">Severity</th>
                    <th className="p-1.5 w-[9%]">CVSS</th>
                    <th className="p-1.5 w-[11%]">CWE</th>
                    <th className="p-1.5 w-[16%]">Target Endpoint</th>
                    <th className="p-1.5 w-[10%]">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVulns.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-1.5 font-mono font-bold text-cyan-800 break-words">{v.id}</td>
                      <td className="p-1.5 font-bold text-slate-900 break-words">{v.title}</td>
                      <td className="p-1.5 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                          v.severity === 'CRITICAL' 
                            ? 'bg-red-100 text-red-900 border border-red-300 font-black' 
                            : v.severity === 'HIGH' 
                            ? 'bg-orange-100 text-orange-900 border border-orange-200' 
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="p-1.5 font-mono font-bold">{v.cvss}</td>
                      <td className="p-1.5 font-mono text-slate-600 break-words">{v.cwe}</td>
                      <td className="p-1.5 font-mono text-slate-600 break-all text-[8.5px]">{v.endpoint || v.target}</td>
                      <td className="p-1.5 font-mono font-bold text-slate-700">
                        {idx === 0 ? 'Urgent' : idx <= 2 ? 'High' : 'Medium'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Severity Rating Guide */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-[10px] uppercase tracking-wider">
                Industry Severity Scoring Guide (CVSS v3.1 Base Metrics)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9.5px] font-mono">
                <div className="p-1.5 rounded bg-red-50 border border-red-200">
                  <strong className="text-red-900 block text-[9px]">CRITICAL (9.0 - 10.0)</strong>
                  <span className="text-slate-600 break-words">Immediate compromise, RCE, or full takeover.</span>
                </div>
                <div className="p-1.5 rounded bg-orange-50 border border-orange-200">
                  <strong className="text-orange-900 block text-[9px]">HIGH (7.0 - 8.9)</strong>
                  <span className="text-slate-600 break-words">Privilege escalation or severe data leak.</span>
                </div>
                <div className="p-1.5 rounded bg-amber-50 border border-amber-200">
                  <strong className="text-amber-900 block text-[9px]">MEDIUM (4.0 - 6.9)</strong>
                  <span className="text-slate-600 break-words">Partial data exposure or configuration flaw.</span>
                </div>
                <div className="p-1.5 rounded bg-slate-100 border border-slate-200">
                  <strong className="text-slate-900 block text-[9px]">LOW (0.1 - 3.9)</strong>
                  <span className="text-slate-600 break-words">Information disclosure or hygiene issue.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Running Footer Anchored cleanly to bottom */}
          <div className="flex items-center justify-between border-t pt-2 mt-auto border-slate-200 text-[9.5px] font-mono text-slate-500">
            <span>CONFIDENTIAL &bull; PROPRIETARY</span>
            <span>Audited by Sennovate Autonomous VAPT Platform</span>
            <span>Page 3 of {totalPages}</span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* PAGES 4+: HIGH-DENSITY SPACE-OPTIMIZED CONTINUOUS FINDINGS                */}
        {/* ========================================================================= */}
        {dynamicFindingPages.map((pageData, pIdx) => {
          const pageNum = 4 + pIdx;
          const { blocks } = pageData;

          return (
            <div 
              key={`dense-finding-page-${pIdx}`}
              className="pdf-page p-[10mm_12mm_10mm_12mm] bg-white text-slate-900 border border-slate-200"
            >
              {/* Running Header */}
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-[9.5px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-600" />
                  Sennovate Autonomous VAPT Deliverable &bull; Detailed Technical Findings
                </span>
                <span className="truncate max-w-[200px]">Target: {companyName}</span>
              </div>

              {/* Space-Optimized Content Body: Starts under header and flows down naturally */}
              <div className="flex-1 flex flex-col justify-start space-y-2.5 pt-2 pb-2">
                {blocks.map((block, bIdx) => renderFindingBlock(block, bIdx))}
              </div>

              {/* Running Footer Anchored cleanly to bottom */}
              <div className="flex items-center justify-between border-t pt-2 mt-auto border-slate-200 text-[9.5px] font-mono text-slate-500">
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
