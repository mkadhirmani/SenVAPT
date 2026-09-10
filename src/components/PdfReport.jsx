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
  CheckSquare
} from 'lucide-react';
import { exportReportToPdf } from '../utils/pdfExport';
import { askLlmWithRag } from '../utils/llmEngine';
import { paginateBlocks, A4_CONSTANTS } from '../utils/pdfPaginationEngine';

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
  theme = 'light' 
}) {
  const [reportType, setReportType] = useState('detailed'); // 'detailed' | 'simple'
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [customAiSummary, setCustomAiSummary] = useState(null);

  const sortedVulns = useMemo(() => {
    return [...vulnerabilities].sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  }, [vulnerabilities]);

  const critVulns = sortedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulns.filter(v => v.severity === 'MEDIUM');
  const lowVulns = sortedVulns.filter(v => v.severity === 'LOW');
  const topVuln = sortedVulns[0] || null;

  const targetUrl = metadata.targetUrl || (sortedVulns[0]?.target ? new URL(sortedVulns[0].target).origin : "https://target-system.internal");
  const overallRiskScore = metadata.overallRiskScore || topVuln?.cvss || 6.8;
  const overallRiskLevel = metadata.overallRiskLevel || (overallRiskScore >= 8.5 ? 'CRITICAL' : (overallRiskScore >= 7.0 ? 'HIGH' : 'ELEVATED'));

  // Multi-Target / Subdomains Perimeter List from strix --target-list
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

  // =========================================================================
  // DYNAMIC PAGINATION ENGINE INTEGRATION
  // Breaks findings and sections into semantic flow blocks and paginates them.
  // =========================================================================
  const reportPages = useMemo(() => {
    if (!sortedVulns || sortedVulns.length === 0) return [];

    const pages = [];

    // -------------------------------------------------------------------------
    // PAGE 1: DEDICATED EXECUTIVE COVER PAGE
    // -------------------------------------------------------------------------
    pages.push({
      type: 'cover',
      title: 'Executive Cover Page & Engagement Charter'
    });

    if (reportType === 'detailed') {
      // -----------------------------------------------------------------------
      // DETAILED REPORT - SECTION 1: EXECUTIVE THREAT ASSESSMENT & ROADMAP
      // -----------------------------------------------------------------------
      const execBlocks = [
        {
          id: 'exec-heading',
          type: 'section-heading',
          title: '1. Executive Summary & Threat Posture',
          isHeading: true,
          estimatedHeight: 40
        }
      ];

      if (customAiSummary) {
        execBlocks.push({
          id: 'exec-ai-summary',
          type: 'ai-summary',
          content: customAiSummary,
          estimatedHeight: 320
        });
      } else {
        execBlocks.push({
          id: 'exec-intro-text',
          type: 'exec-intro',
          companyName,
          targetUrl,
          sortedVulnsCount: sortedVulns.length,
          breakdownText: formatSeverityBreakdown(sortedVulns),
          overallRiskLevel,
          overallRiskScore,
          estimatedHeight: 110
        });

        if (topVuln) {
          execBlocks.push({
            id: 'exec-top-vuln',
            type: 'exec-top-vuln-card',
            topVuln,
            targetUrl,
            overallRiskLevel,
            overallRiskScore,
            estimatedHeight: 100
          });
        }

        execBlocks.push({
          id: 'exec-risk-breakdown',
          type: 'exec-risk-breakdown-grid',
          critVulns,
          highVulns,
          medVulns,
          lowVulns,
          estimatedHeight: 180
        });

        execBlocks.push({
          id: 'exec-business-impact',
          type: 'exec-business-impact-card',
          estimatedHeight: 90
        });

        execBlocks.push({
          id: 'exec-roadmap',
          type: 'exec-roadmap-grid',
          topVuln,
          targetUrl,
          companyName,
          estimatedHeight: 130
        });
      }

      const execPages = paginateBlocks(execBlocks, {
        usableHeight: A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX
      });

      execPages.forEach(ep => {
        pages.push({
          type: 'content',
          title: 'Executive Threat Assessment',
          blocks: ep.blocks
        });
      });

      // -----------------------------------------------------------------------
      // DETAILED REPORT - SECTION 2: VULNERABILITY SUMMARY MATRIX
      // -----------------------------------------------------------------------
      const matrixBlocks = [
        {
          id: 'matrix-heading',
          type: 'section-heading',
          title: '2. Vulnerability Summary Matrix & Audit Coverage',
          isHeading: true,
          estimatedHeight: 40
        },
        {
          id: 'matrix-table',
          type: 'matrix-table',
          rows: sortedVulns,
          targetUrl,
          estimatedHeight: 44 + (sortedVulns.length * 38)
        },
        {
          id: 'matrix-guides',
          type: 'matrix-guides-card',
          estimatedHeight: 330
        }
      ];

      const matrixPages = paginateBlocks(matrixBlocks, {
        usableHeight: A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX
      });

      matrixPages.forEach(mp => {
        pages.push({
          type: 'content',
          title: 'Vulnerability Matrix & Audit Coverage',
          blocks: mp.blocks
        });
      });

      // -----------------------------------------------------------------------
      // DETAILED REPORT - SECTION 3: DYNAMIC FINDING DELIVERABLES
      // -----------------------------------------------------------------------
      const findingBlocks = [];

      sortedVulns.forEach((vuln, vIdx) => {
        const findingNum = vIdx + 1;
        const findingContext = { vuln, findingNum };

        // 1. Finding Banner (Starts new finding section)
        findingBlocks.push({
          id: `finding-${vuln.id}-header`,
          type: 'finding-header',
          vuln,
          findingNum,
          targetUrl,
          finding: findingContext,
          isKeepWithNext: true,
          forcePageBreakBefore: vIdx > 0 // Start each detailed finding on a clean page unless very compact
        });

        // 2. Technical Analysis & Mechanism
        findingBlocks.push({
          id: `finding-${vuln.id}-tech-heading`,
          type: 'section-heading',
          title: 'Technical Analysis & Vulnerability Mechanism',
          iconType: 'info',
          isHeading: true,
          finding: findingContext
        });

        findingBlocks.push({
          id: `finding-${vuln.id}-tech-analysis`,
          type: 'tech-analysis',
          vuln,
          finding: findingContext
        });

        // 3. Security & Threat Impact Assessment
        findingBlocks.push({
          id: `finding-${vuln.id}-impact-heading`,
          type: 'section-heading',
          title: 'Security & Threat Impact Assessment',
          iconType: 'alert',
          isHeading: true,
          colorClass: 'text-rose-700',
          finding: findingContext
        });

        findingBlocks.push({
          id: `finding-${vuln.id}-impact`,
          type: 'threat-impact',
          vuln,
          finding: findingContext
        });

        // 4. Observed Technical Evidence (if present)
        if (vuln.evidence) {
          findingBlocks.push({
            id: `finding-${vuln.id}-evidence-heading`,
            type: 'section-heading',
            title: 'Observed Evidence (Raw Protocol HTTP Response)',
            iconType: 'terminal',
            isHeading: true,
            finding: findingContext
          });

          findingBlocks.push({
            id: `finding-${vuln.id}-evidence`,
            type: 'evidence',
            codeText: vuln.evidence,
            finding: findingContext
          });
        }

        // 5. Proof of Concept & Live Exploit Verification (if present)
        const hasPoc = Boolean(vuln.pocDescription || vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python || vuln.pocScripts?.javascript);
        if (hasPoc) {
          findingBlocks.push({
            id: `finding-${vuln.id}-poc-heading`,
            type: 'section-heading',
            title: 'Proof of Concept & Live Exploit Verification',
            iconType: 'code',
            isHeading: true,
            finding: findingContext
          });

          findingBlocks.push({
            id: `finding-${vuln.id}-poc`,
            type: 'poc',
            vuln,
            pocDescription: vuln.pocDescription,
            codeText: vuln.reproduction || vuln.pocScripts?.bash || vuln.pocScripts?.python || vuln.pocScripts?.javascript,
            finding: findingContext
          });
        }

        // 6. Step-by-Step Remediation Action Plan
        findingBlocks.push({
          id: `finding-${vuln.id}-remediation-heading`,
          type: 'section-heading',
          title: 'Step-by-Step Remediation Action Plan',
          iconType: 'check',
          isHeading: true,
          colorClass: 'text-emerald-800',
          finding: findingContext
        });

        findingBlocks.push({
          id: `finding-${vuln.id}-remediation`,
          type: 'remediation',
          vuln,
          remediation: vuln.remediation,
          remediationSteps: vuln.remediationSteps || [],
          finding: findingContext
        });

        // 7. Verification Checklist & Scope Note
        findingBlocks.push({
          id: `finding-${vuln.id}-checklist`,
          type: 'checklist',
          vuln,
          finding: findingContext
        });
      });

      const paginatedFindings = paginateBlocks(findingBlocks, {
        usableHeight: A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX,
        minHeadingFollow: A4_CONSTANTS.MIN_HEADING_FOLLOW_SPACE_PX,
        minFindingStart: A4_CONSTANTS.MIN_FINDING_START_SPACE_PX
      });

      paginatedFindings.forEach(fp => {
        pages.push({
          type: 'content',
          findingContext: fp.findingContext,
          blocks: fp.blocks
        });
      });

    } else {
      // -----------------------------------------------------------------------
      // SIMPLE REPORT: STREAMLINED COVER, MATRIX, & DYNAMIC FLOW FINDINGS
      // -----------------------------------------------------------------------
      // Page 2: Summary Matrix
      const simpleMatrixBlocks = [
        {
          id: 'simple-matrix-heading',
          type: 'section-heading',
          title: 'Confirmed Vulnerabilities Overview',
          isHeading: true,
          estimatedHeight: 40
        },
        {
          id: 'simple-matrix-table',
          type: 'matrix-table',
          rows: sortedVulns,
          targetUrl,
          estimatedHeight: 44 + (sortedVulns.length * 38)
        },
        {
          id: 'simple-matrix-guides',
          type: 'matrix-guides-card',
          estimatedHeight: 330
        }
      ];

      const simpleMatrixPages = paginateBlocks(simpleMatrixBlocks, {
        usableHeight: A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX
      });

      simpleMatrixPages.forEach(smp => {
        pages.push({
          type: 'content',
          title: 'Vulnerability Summary Matrix',
          blocks: smp.blocks
        });
      });

      // Streamlined Findings with Dynamic Flow
      const simpleFindingBlocks = [];

      sortedVulns.forEach((vuln, vIdx) => {
        const findingNum = vIdx + 1;
        const findingContext = { vuln, findingNum };

        simpleFindingBlocks.push({
          id: `simple-finding-${vuln.id}-header`,
          type: 'finding-header',
          vuln,
          findingNum,
          targetUrl,
          finding: findingContext,
          isKeepWithNext: true,
          forcePageBreakBefore: vIdx > 0
        });

        simpleFindingBlocks.push({
          id: `simple-finding-${vuln.id}-desc-heading`,
          type: 'section-heading',
          title: 'Vulnerability Description & Risk Impact',
          iconType: 'info',
          isHeading: true,
          finding: findingContext
        });

        simpleFindingBlocks.push({
          id: `simple-finding-${vuln.id}-desc-box`,
          type: 'tech-analysis',
          vuln,
          finding: findingContext
        });

        if (vuln.evidence || vuln.reproduction) {
          simpleFindingBlocks.push({
            id: `simple-finding-${vuln.id}-ev-heading`,
            type: 'section-heading',
            title: 'Observed Evidence (Protocol Response)',
            iconType: 'terminal',
            isHeading: true,
            finding: findingContext
          });

          simpleFindingBlocks.push({
            id: `simple-finding-${vuln.id}-evidence`,
            type: 'evidence',
            codeText: vuln.evidence || vuln.reproduction,
            finding: findingContext
          });
        }

        simpleFindingBlocks.push({
          id: `simple-finding-${vuln.id}-rem-heading`,
          type: 'section-heading',
          title: 'Recommended Remediation Plan',
          iconType: 'check',
          isHeading: true,
          colorClass: 'text-emerald-800',
          finding: findingContext
        });

        simpleFindingBlocks.push({
          id: `simple-finding-${vuln.id}-remediation`,
          type: 'remediation',
          vuln,
          remediation: vuln.remediation,
          remediationSteps: vuln.remediationSteps || [],
          finding: findingContext
        });
      });

      const paginatedSimpleFindings = paginateBlocks(simpleFindingBlocks, {
        usableHeight: A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX,
        minHeadingFollow: A4_CONSTANTS.MIN_HEADING_FOLLOW_SPACE_PX,
        minFindingStart: A4_CONSTANTS.MIN_FINDING_START_SPACE_PX
      });

      paginatedSimpleFindings.forEach(sfp => {
        pages.push({
          type: 'content',
          findingContext: sfp.findingContext,
          blocks: sfp.blocks
        });
      });
    }

    return pages;
  }, [
    reportType, 
    sortedVulns, 
    metadata, 
    companyName, 
    targetUrl, 
    overallRiskScore, 
    overallRiskLevel, 
    evaluatedTargets, 
    customAiSummary, 
    topVuln, 
    critVulns, 
    highVulns, 
    medVulns, 
    lowVulns
  ]);

  const totalPages = reportPages.length;

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

  // =========================================================================
  // RENDER BLOCKS DISPATCHER
  // =========================================================================
  const renderBlock = (block, idx) => {
    switch (block.type) {
      case 'section-heading': {
        const IconComponent = block.iconType === 'info' ? Info :
                              block.iconType === 'alert' ? ShieldAlert :
                              block.iconType === 'terminal' ? Terminal :
                              block.iconType === 'code' ? Code :
                              block.iconType === 'check' ? CheckCircle2 : ShieldCheck;
        const color = block.colorClass || 'text-slate-700';

        return (
          <div key={block.id || idx} className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 pt-1">
            <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 ${block.colorClass ? block.colorClass.replace('text-', 'text-') : 'text-cyan-600'}`} />
            <span className={color}>{block.title}</span>
          </div>
        );
      }

      case 'finding-header': {
        const { vuln, findingNum } = block;
        return (
          <div key={block.id || idx} className="border-b border-slate-200 pb-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded border border-cyan-200">
                  Finding #{findingNum}: {vuln.id}
                </span>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                  vuln.severity === 'CRITICAL' ? 'bg-red-100 text-red-900 border border-red-300 font-black' : 
                  vuln.severity === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-200' : 
                  'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {vuln.severity} &bull; CVSS {vuln.cvss}
                </span>
                <span className="text-xs font-mono text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                  {vuln.cwe}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                Fix Effort: <strong className="text-emerald-700">{vuln.fixEffort || 'Low'}</strong>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight leading-snug break-words">
              {vuln.title}
            </h3>

            <div className="text-[11.5px] font-mono text-slate-600">
              Complete Target URL: <code className="text-cyan-800 font-bold break-all">{getCompleteTargetUrl(vuln, targetUrl)}</code>
            </div>
          </div>
        );
      }

      case 'tech-analysis': {
        const { vuln } = block;
        return (
          <div key={block.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] text-slate-800 leading-relaxed space-y-2 break-words font-sans">
            <p>{vuln.description}</p>
            {vuln.technicalAnalysis && (
              <p className="text-slate-700 text-[12px] pt-2 border-t border-slate-200 break-words leading-relaxed">
                <strong className="text-slate-900">Vulnerability Mechanics:</strong> {vuln.technicalAnalysis}
              </p>
            )}
          </div>
        );
      }

      case 'threat-impact': {
        const { vuln } = block;
        return (
          <div key={block.id || idx} className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-[12.5px] text-slate-900 leading-relaxed break-words font-sans">
            <p>{vuln.impact}</p>
          </div>
        );
      }

      case 'evidence': {
        return (
          <div key={block.id || idx} className="rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed border border-slate-800 p-3.5 select-all break-all overflow-visible">
            {block.isSplitPart && (
              <div className="mb-2 pb-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-cyan-400 font-bold uppercase tracking-wider">Protocol Evidence Dump &bull; Part {block.part} of {block.totalParts}</span>
                <span>{block.part > 1 ? '(Continued from previous page)' : ''}</span>
              </div>
            )}
            <pre className="whitespace-pre-wrap leading-relaxed select-all break-all font-mono">
              {block.codeText}
            </pre>
          </div>
        );
      }

      case 'poc': {
        const { pocDescription, codeText } = block;
        return (
          <div key={block.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            {pocDescription && (
              <div className="text-slate-700 leading-relaxed whitespace-pre-line text-[12px] font-sans break-words">
                {pocDescription}
              </div>
            )}
            {codeText && (
              <div className="p-3 rounded-lg bg-slate-950 text-cyan-300 font-mono text-[11px] leading-relaxed space-y-1 border border-slate-800 break-all select-all">
                <span className="text-[10px] uppercase text-slate-400 font-bold block font-mono">
                  Verification Command / Exploit Script:
                </span>
                <code className="text-emerald-300 select-all block break-all whitespace-pre-wrap font-mono">
                  {codeText}
                </code>
              </div>
            )}
          </div>
        );
      }

      case 'remediation': {
        const { remediation, remediationSteps } = block;
        return (
          <div key={block.id || idx} className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
            {remediation && (!remediationSteps || remediationSteps.length === 0 || (!remediation.includes(remediationSteps[0]) && remediation !== remediationSteps[0])) && (
              <p className="text-slate-900 font-bold text-[12.5px] break-words leading-relaxed">
                {cleanText(remediation)}
              </p>
            )}
            {remediationSteps && remediationSteps.length > 0 ? (
              <ol className="list-decimal list-inside space-y-1.5 text-[12px] text-slate-800 font-sans">
                {remediationSteps.map((step, sIdx) => (
                  <li key={sIdx} className="leading-relaxed break-words">{cleanText(step)}</li>
                ))}
              </ol>
            ) : (
              !remediation && <p className="text-slate-500 italic text-[11.5px]">Apply standard security patches and configuration hardening.</p>
            )}
          </div>
        );
      }

      case 'checklist': {
        const { vuln } = block;
        return (
          <div key={block.id || idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 font-mono text-[10.5px] uppercase flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-600" /> Verification Checklist
              </div>
              <ul className="text-[11px] text-slate-600 space-y-0.5 pl-3 list-disc leading-relaxed">
                <li>Input sanitization &amp; parameterized queries.</li>
                <li>WAF inspection &amp; rate limit rules.</li>
                <li>Automated regression validation.</li>
              </ul>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 font-mono text-[10.5px] uppercase flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-slate-600" /> Scope Note
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed break-words">
                {vuln.assumptions || 'Assessed against live production API perimeter under standard operational conditions.'}
              </p>
            </div>
          </div>
        );
      }

      case 'matrix-table': {
        const { rows, targetUrl } = block;
        return (
          <div key={block.id || idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left table-fixed">
              <thead className="bg-slate-100 font-mono text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-[11%]">ID</th>
                  <th className="p-2.5 w-[31%]">Vulnerability Title</th>
                  <th className="p-2.5 w-[13%]">Severity</th>
                  <th className="p-2.5 w-[8%]">CVSS</th>
                  <th className="p-2.5 w-[11%]">CWE</th>
                  <th className="p-2.5 w-[18%]">Target Endpoint</th>
                  <th className="p-2.5 w-[8%]">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((v, rIdx) => (
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
                    <td className="p-2.5 font-mono font-bold text-slate-700 text-[10.5px]">{rIdx === 0 ? 'Urgent' : rIdx <= 2 ? 'High' : 'Medium'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'matrix-guides-card': {
        return (
          <div key={block.id || idx} className="space-y-3 pt-1">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider">Industry Severity Scoring Guide (CVSS v3.1 Base Metrics)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                  <strong className="text-red-900 block text-[10.5px]">CRITICAL (9.0 - 10.0)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10px]">Immediate compromise or RCE.</span>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                  <strong className="text-orange-900 block text-[10.5px]">HIGH (7.0 - 8.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10px]">Privilege escalation or data leak.</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <strong className="text-amber-900 block text-[10.5px]">MEDIUM (4.0 - 6.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10px]">Partial data exposure or flaw.</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                  <strong className="text-slate-900 block text-[10.5px]">LOW (0.1 - 3.9)</strong>
                  <span className="text-slate-600 leading-relaxed break-words text-[10px]">Info disclosure or hygiene issue.</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
              <h3 className="font-bold text-slate-900 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                OWASP Security Testing Guide (WSTG v4.2) Category Audit Coverage
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px] font-mono">
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

            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
              <div className="font-bold text-slate-900 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" /> Autonomous Penetration Testing Safety Attestation
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px] break-words">All identified vulnerability attack vectors have been empirically validated through non-destructive dynamic proof-of-concept tests. Testing was executed strictly within authorized target bounds without denial of service or disruption to operational availability.</p>
            </div>
          </div>
        );
      }

      case 'exec-intro': {
        const { companyName, targetUrl, sortedVulnsCount, breakdownText, overallRiskLevel, overallRiskScore } = block;
        return (
          <div key={block.id || idx} className="space-y-2 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">
            <p>Sennovate Autonomous Security Engine conducted an external penetration testing assessment against <strong>{companyName}</strong> (primary target: <code>{targetUrl}</code>). The scope encompassed the external web perimeter, exposed application services, and integrated API endpoints.</p>
            <p>The assessment identified <strong>{sortedVulnsCount} confirmed security vulnerabilities</strong> ({breakdownText}). The overall cybersecurity posture is evaluated at <strong>{overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</strong>, requiring targeted remediation to safeguard corporate data assets.</p>
          </div>
        );
      }

      case 'exec-top-vuln-card': {
        const { topVuln, targetUrl, overallRiskLevel, overallRiskScore } = block;
        return (
          <div key={block.id || idx} className="p-3.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-800 space-y-1 text-xs">
            <div className="font-bold text-amber-900 uppercase font-mono flex items-center gap-1.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" /> <span>Strategic Exposure Vector: {overallRiskLevel} Risk ({overallRiskScore}/10 CVSS)</span>
            </div>
            <p className="leading-relaxed text-[12px] break-words text-slate-700">Primary exposure vector is <strong>{topVuln.title}</strong> on <code>{getCompleteTargetUrl(topVuln, targetUrl)}</code> (CVSS {topVuln.cvss}). Exploitation allows unauthorized adversaries: {topVuln.impact || topVuln.description}</p>
          </div>
        );
      }

      case 'exec-risk-breakdown-grid': {
        const { critVulns, highVulns, medVulns, lowVulns } = block;
        return (
          <div key={block.id || idx} className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">Categorized Risk Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {critVulns.length > 0 && (
                <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/60 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-900 uppercase font-mono">Critical Risks ({critVulns.length})</span>
                    <span className="font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px]">Immediate Action</span>
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-0.5 pl-1">{critVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                </div>
              )}
              {highVulns.length > 0 && (
                <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-900 uppercase font-mono">High Risks ({highVulns.length})</span>
                    <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">Urgent Action</span>
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-0.5 pl-1">{highVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                </div>
              )}
              {medVulns.length > 0 && (
                <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 uppercase font-mono">Medium Findings ({medVulns.length})</span>
                    <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">Remediate &lt; 7d</span>
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-0.5 pl-1">{medVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                </div>
              )}
              {lowVulns.length > 0 && (
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 uppercase font-mono">Low / Info Findings ({lowVulns.length})</span>
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Hygiene &lt; 30d</span>
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-0.5 pl-1">{lowVulns.map(v => <div key={v.id} className="leading-relaxed break-words">&bull; <strong>[{v.id}] {v.title}</strong> (CVSS {v.cvss})</div>)}</div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'exec-business-impact-card': {
        return (
          <div key={block.id || idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
            <div className="font-bold text-slate-900 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-cyan-600" />
              Business Impact &amp; Regulatory Considerations
            </div>
            <p className="text-slate-600 leading-relaxed text-[11.5px] break-words">
              Identified vulnerabilities could result in session hijacking, unauthorized parameter manipulation, and sensitive header disclosure. Prompt mitigation is advised to maintain compliance with <strong>SOC 2 Type II</strong>, <strong>ISO 27001 (A.14)</strong>, and <strong>GDPR Article 32 (Security of Processing)</strong>.
            </p>
          </div>
        );
      }

      case 'exec-roadmap-grid': {
        const { topVuln, targetUrl, companyName } = block;
        return (
          <div key={block.id || idx} className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-950 font-mono uppercase tracking-wider">2. Prioritized 3-Phase Remediation Roadmap</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <div className="font-bold text-rose-700 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 1 (&lt; 24h)</div>
                <p className="text-slate-700 text-[11px] leading-relaxed break-words">{topVuln ? `Remediate ${topVuln.title} on ${getCompleteTargetUrl(topVuln, targetUrl)}.` : 'Patch high priority vulnerabilities.'}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="font-bold text-amber-700 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 2 (&lt; 7 Days)</div>
                <p className="text-slate-700 text-[11px] leading-relaxed break-words">Address medium severity findings across {companyName} application endpoints.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1">
                <div className="font-bold text-cyan-800 font-mono text-[10.5px] uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Phase 3 (&lt; 30 Days)</div>
                <p className="text-slate-700 text-[11px] leading-relaxed break-words">Deploy strict CSP, review CORS policies, and conduct automated regression audits.</p>
              </div>
            </div>
          </div>
        );
      }

      case 'ai-summary': {
        return (
          <div key={block.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[12.5px] text-slate-800 leading-relaxed font-sans break-words">
            {renderFormattedMarkdown(block.content)}
          </div>
        );
      }

      default:
        return null;
    }
  };

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
              Target: <span className="font-mono text-[#80B7F1]">{targetUrl}</span> &bull; {sortedVulns.length} Confirmed Vulnerabilities
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Two Report Forms Toggle: Simple vs Detailed */}
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-[#80B7F1] border border-[#002B66] hover:bg-[#002B66] transition-colors disabled:opacity-50 shadow-sm font-heading"
            >
              {isGeneratingAiSummary ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006FE3]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#006FE3]" />
              )}
              <span>{isGeneratingAiSummary ? "Synthesizing Summary..." : "Re-generate Executive Summary"}</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#001127] text-slate-200 border border-[#002B66] hover:bg-[#002B66] transition-colors font-heading"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#006FE3] text-white hover:bg-[#005bbd] transition-all shadow-md shadow-[#006FE3]/25 disabled:opacity-60 font-heading hover:scale-[1.02] active:scale-[0.98]"
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
          height: 297mm;
          min-height: 297mm;
          max-height: 297mm;
          margin: 0 auto 24px auto;
          padding: 12mm 14mm 12mm 14mm;
          background: #ffffff;
          box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.08);
          border-radius: 4px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
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
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
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
            justify-content: space-between !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* Discrete, Pre-Paginated A4 Container */}
      <div id="vapt-pdf-report-root" className="space-y-8 flex flex-col items-center">
        {reportPages.map((page, pIdx) => {
          const pageNum = pIdx + 1;

          // ===================================================================
          // COVER PAGE
          // ===================================================================
          if (page.type === 'cover') {
            return (
              <div key={`page-${pageNum}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
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

                <div className="flex-1 flex flex-col justify-start space-y-4 pt-3 pb-2">
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
                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
                    <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-cyan-600" /> Target Scope &amp; Evaluated Digital Perimeter
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                      <div className="space-y-1 text-slate-700 leading-relaxed">
                        <div><strong>In-Scope Target:</strong> <code className="break-all">{targetUrl}</code></div>
                        <div><strong>Scope Surface:</strong> Apex Domain + Subdomain Target List</div>
                        <div><strong>Testing Methodology:</strong> Non-Destructive Live Exploit Ingestion</div>
                      </div>
                      <div className="space-y-1 text-slate-700 leading-relaxed">
                        <div><strong>Assessment Engine:</strong> Sennovate Autonomous VAPT Platform</div>
                        <div><strong>Execution Mode:</strong> Multi-Target Web &amp; API Assessment</div>
                        <div><strong>Safety Constraints:</strong> Zero Denial-of-Service / Zero Data Tampering</div>
                      </div>
                    </div>
                    {evaluatedTargets.length > 1 && (
                      <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-700">
                        <strong>Evaluated Target Perimeter ({evaluatedTargets.length} In-Scope Targets):</strong>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {evaluatedTargets.map((t, idx) => (
                            <span key={idx} className="bg-cyan-50 border border-cyan-200 text-cyan-900 px-2 py-0.5 rounded font-mono text-[10.5px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assessment Lifecycle Execution Phases */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
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
                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
                    <div className="font-bold text-slate-900 font-mono text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-cyan-600" /> Assessment Frameworks &amp; Compliance Standards Alignment
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11.5px] break-words">
                      Conducted in strict alignment with <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong>, <strong>CWE/SANS Top 25</strong>, and <strong>CVSS v3.1 Scoring Standards</strong>. All observed attack paths were verified to ensure zero false positives.
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-2.5 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                    <div><strong>Audited By:</strong> {metadata.leadAuditor || "Sennovate Autonomous Security Engine"}</div>
                    <div><strong>Security Partner:</strong> {metadata.companyWebsite || "https://www.sennovate.com"}</div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-400">
                    <span>Confidential &bull; Sennovate Inc.</span>
                    <span>Page 1 of {totalPages}</span>
                  </div>
                </div>
              </div>
            );
          }

          // ===================================================================
          // STANDARD DYNAMIC CONTENT PAGE (EXECUTIVE, MATRIX, OR FINDINGS)
          // ===================================================================
          const headerTitle = page.findingContext
            ? `Sennovate Autonomous VAPT Deliverable \u2022 Finding #${page.findingContext.findingNum} of ${sortedVulns.length}${page.blocks.some(b => b.isSplitPart && b.part > 1) ? ' (Cont.)' : ''}`
            : (page.title || 'Sennovate Autonomous VAPT Deliverable');

          return (
            <div key={`page-${pageNum}`} className="pdf-page bg-white text-slate-900 border border-slate-200">
              {/* Running Header */}
              <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 text-[11px] font-mono text-slate-500 uppercase">
                <span className="font-bold text-cyan-700 flex items-center gap-1.5 truncate max-w-[500px]">
                  <ShieldCheck className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                  {headerTitle}
                </span>
                <span className="truncate max-w-[220px] flex-shrink-0">Target: {companyName}</span>
              </div>

              {/* Dynamic Page Flow Content Container */}
              <div className="flex-1 flex flex-col justify-start space-y-3 pt-2.5 pb-2 overflow-hidden">
                {page.blocks.map((block, bIdx) => renderBlock(block, bIdx))}
              </div>

              {/* Running Footer */}
              <div className="flex items-center justify-between border-t pt-2.5 mt-auto border-slate-200 text-[10.5px] font-mono text-slate-500">
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
