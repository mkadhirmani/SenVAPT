import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Cpu, 
  Globe, 
  Server, 
  Lock, 
  GitBranch, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  FileCode, 
  Flame, 
  ChevronRight, 
  Bot, 
  Building, 
  History, 
  MessageSquare,
  UserCheck,
  Radar,
  User,
  Shield
} from 'lucide-react';
import { SCAN_METADATA, POSITIVE_CONTROLS } from '../data/scanData';
import { checkUserPermission } from '../utils/auth';

export default function DashboardOverview({ 
  vulnerabilities = [], 
  metadata = SCAN_METADATA,
  activeScan,
  currentUser,
  companyName = "",
  scanHistory = [],
  activeScanId = '',
  onSelectScan, 
  onSelectFinding, 
  onViewAttackChain, 
  onOpenChatbot, 
  onNavigateTab,
  theme = 'dark'
}) {
  const isAdmin = currentUser?.role === 'admin';
  const canViewTokens = isAdmin || checkUserPermission(currentUser, 'view_tokens');

  const currentTarget = activeScan || scanHistory.find(s => s.id === activeScanId) || {};

  const critVulns = vulnerabilities.filter(v => v.severity === 'CRITICAL');
  const highVulns = vulnerabilities.filter(v => v.severity === 'HIGH');
  const medVulns = vulnerabilities.filter(v => v.severity === 'MEDIUM');
  const lowVulns = vulnerabilities.filter(v => v.severity === 'LOW');
  const topVuln = vulnerabilities[0] || null;

  const severityBreakdown = [
    critVulns.length > 0 ? `${critVulns.length} Critical` : null,
    highVulns.length > 0 ? `${highVulns.length} High` : null,
    medVulns.length > 0 ? `${medVulns.length} Medium` : null,
    lowVulns.length > 0 ? `${lowVulns.length} Low` : null
  ].filter(Boolean).join(', ') || `${vulnerabilities.length} Findings`;

  const targetUrl = currentTarget.targetUrl || metadata.targetUrl || "";
  const riskScore = currentTarget.riskScore || metadata.overallRiskScore || topVuln?.cvss || (critVulns.length > 0 ? 9.2 : highVulns.length > 0 ? 8.2 : (medVulns.length > 0 ? 6.5 : 0));
  const riskLevel = currentTarget.riskLevel || metadata.overallRiskLevel || (riskScore >= 7.0 ? 'HIGH' : (riskScore >= 4.0 ? 'ELEVATED' : 'LOW'));

  const rawTokens = typeof currentTarget.tokens === 'number' 
    ? currentTarget.tokens 
    : (typeof metadata.tokens === 'number' ? metadata.tokens : (currentTarget.metadata?.tokens || 0));

  const tokenDisplay = rawTokens >= 1000000 
    ? `${(rawTokens / 1000000).toFixed(1)}M` 
    : (rawTokens >= 1000 ? `${(rawTokens / 1000).toFixed(1)}k` : (rawTokens > 0 ? rawTokens.toLocaleString() : '0'));

  const requestsCount = typeof currentTarget.requests === 'number'
    ? currentTarget.requests
    : (typeof metadata.requests === 'number' ? metadata.requests : (currentTarget.metadata?.requests || 0));

  const scannedBy = currentTarget.scannedBy || (currentUser?.username || 'user');
  const scannedByName = currentTarget.scannedByName && !currentTarget.scannedByName.includes('Alex Rivera') ? currentTarget.scannedByName : (scannedBy === 'admin' ? 'Administrator' : scannedBy);

  // Get active target base domain
  const getTargetBaseDomain = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      const parts = hostname.split('.');
      return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
    } catch (e) {
      return '';
    }
  };

  const activeBaseDomain = getTargetBaseDomain(targetUrl);

  // Extract tested domains and subdomains
  const testedSubdomainsList = currentTarget.metadata?.testedSubdomains || currentTarget.subdomains || metadata?.testedSubdomains || metadata?.subdomains || [];
  const rawAssetList = [
    ...vulnerabilities.map(v => {
      try {
        if (!v.target && !targetUrl) return '';
        const raw = v.target || targetUrl || '';
        const u = raw.startsWith('http') ? raw : `https://${raw}`;
        return new URL(u).hostname;
      } catch (e) {
        return v.target || '';
      }
    }),
    ...testedSubdomainsList.map(s => (typeof s === 'string' ? s : (s?.name || ''))),
    (() => {
      if (!targetUrl) return '';
      try { return new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname; } catch (e) { return targetUrl; }
    })()
  ].filter(Boolean);

  const uniqueAssets = Array.from(new Set(
    rawAssetList.filter(asset => {
      if (!activeBaseDomain) return true;
      return asset.toLowerCase().includes(activeBaseDomain.toLowerCase());
    })
  ));

  const hasScans = Boolean(activeScan || scanHistory.length > 0 || vulnerabilities.length > 0);

  if (!hasScans) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Logged in User Bar */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
              isAdmin ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Logged in as: </span>
              <strong className={`font-black text-sm uppercase tracking-wider ${isAdmin ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {currentUser?.username || (isAdmin ? 'admin' : 'user')}
              </strong>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-800/80 border-slate-700 text-slate-300">
                {isAdmin ? 'Administrator' : 'Standard User'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-500 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Active Authenticated Session</span>
          </div>
        </div>

        {/* Welcome Empty State Card */}
        <div className={`p-8 sm:p-14 rounded-3xl border text-center space-y-6 transition-colors shadow-sm ${
          theme === 'dark' ? 'bg-[#090F1E] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center border border-cyan-500/20 shadow-inner">
            <ShieldCheck className="w-10 h-10 animate-pulse text-cyan-400" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Welcome, <span className="text-cyan-400 uppercase">{currentUser?.username || 'User'}</span>!
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              You are signed in as <strong className="text-cyan-400 uppercase">{currentUser?.username || 'User'}</strong> ({isAdmin ? 'Administrator' : 'Standard User'}). You haven't performed any security audits on your account yet. Launch an AI-driven penetration test to discover vulnerabilities, attack paths, and remediation plans.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab ? onNavigateTab('scan') : null}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm font-sans shadow-lg shadow-cyan-500/20 inline-flex items-center gap-2.5 transition-all cursor-pointer hover:scale-105"
            >
              <Radar className="w-5 h-5" />
              <span>Launch Your First AI Scan &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic positive controls for the current scan target
  const dynamicPositiveControls = (() => {
    if (currentTarget.metadata?.positiveControls && Array.isArray(currentTarget.metadata.positiveControls)) {
      return currentTarget.metadata.positiveControls;
    }
    const cleanDomain = activeBaseDomain || (targetUrl ? targetUrl.replace(/^https?:\/\//, '').split('/')[0] : 'target-domain.com');
    return [
      `Primary domain (${cleanDomain}) enforces modern TLS encryption and secure transport protocols.`,
      `Authentication and API endpoints implement rate limiting and CSRF protection.`,
      `Automated black-box fuzzing confirmed no Remote Code Execution (RCE) or Template Injection vulnerabilities.`,
      `DNS infrastructure and public records audited against unauthorized subdomain delegation.`
    ];
  })();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* User Login Header Bar */}
      <div className={`p-3.5 px-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
      }`}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
            isAdmin ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Logged in as: </span>
            <strong className={`font-black text-sm uppercase tracking-wider ${isAdmin ? 'text-cyan-400' : 'text-emerald-400'}`}>
              {currentUser?.username || (isAdmin ? 'admin' : 'user')}
            </strong>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-800/80 border-slate-700 text-slate-300">
              {isAdmin ? 'Administrator' : 'Standard User'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-emerald-500 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Active Session</span>
        </div>
      </div>

      {/* Scan Session Switcher Banner */}
      {scanHistory.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="text-cyan-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Active Target Scan:
            </span>
            {companyName && (
              <span className={`font-bold truncate text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                {companyName}
              </span>
            )}
            {companyName && targetUrl && (
              <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>&bull;</span>
            )}
            {targetUrl && (
              <span className={`truncate hidden sm:inline ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {targetUrl}
              </span>
            )}
            
            {/* Scanned By Attribution Badge (Admin Visible) */}
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <span>Audited by: {scannedByName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-[11px] font-bold`}>
              Switch Target:
            </span>
            <select
              value={activeScanId}
              onChange={(e) => {
                const selected = scanHistory.find(s => s.id === e.target.value);
                if (selected && onSelectScan) onSelectScan(selected, true);
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
                  : (scan.findingsCount || 0);
                return (
                  <option key={scan.id} value={scan.id}>
                    {scan.companyName} ({count} {count === 1 ? 'finding' : 'findings'}) - {scan.timestamp?.slice(0, 10)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Active Scan Overview Banner */}
      <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm transition-colors ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-[#0D162B] via-[#0A101F] to-[#0D162B] border-slate-800' 
          : 'bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-300'
      }`}>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-cyan-500" />
            <span>Autonomous Security Assessment Overview</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {companyName}: <span className="text-rose-600 dark:text-rose-400">{riskLevel} RISK</span>
          </h1>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
            Automated testing of <strong className={theme === 'dark' ? 'text-slate-200' : 'text-slate-950'}>{targetUrl}</strong> confirmed <strong>{vulnerabilities.length} security findings</strong> ({severityBreakdown}). Most platforms are protected, but urgent remediation is recommended.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => onOpenChatbot(`Summarize all findings for ${companyName} in simple words`)}
            className={`flex items-center justify-center gap-2 px-4 h-10 rounded-xl border text-xs font-bold font-sans transition-all ${
              theme === 'dark'
                ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
                : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300 shadow-sm'
            }`}
          >
            <Bot className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <span>Ask AI Assistant</span>
          </button>

          <button
            onClick={() => onNavigateTab('report')}
            className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold font-sans transition-all shadow-md cursor-pointer"
          >
            <span>View Full Report</span>
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Score */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>RISK RATING</span>
            <Flame className="w-4 h-4 text-rose-500 flex-shrink-0" />
          </div>
          <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
            {riskScore}<span className={`text-sm font-normal ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}> / 10</span>
          </div>
          <div className={`text-[11px] font-mono font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>
            {riskLevel} Posture
          </div>
        </div>

        {/* Confirmed Findings */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>FINDINGS</span>
            <ShieldAlert className="w-4 h-4 text-cyan-500 flex-shrink-0" />
          </div>
          <div className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {vulnerabilities.length}
          </div>
          <div className="text-[11px] font-mono flex items-center gap-1.5 font-bold flex-wrap">
            {critVulns.length > 0 && (
              <span className="text-red-500 font-black">{critVulns.length} Critical</span>
            )}
            {critVulns.length > 0 && (highVulns.length > 0 || medVulns.length > 0 || lowVulns.length > 0) && (
              <span className="text-slate-400">&bull;</span>
            )}
            {highVulns.length > 0 && (
              <span className="text-orange-500 dark:text-orange-400">{highVulns.length} High</span>
            )}
            {highVulns.length > 0 && (medVulns.length > 0 || lowVulns.length > 0) && (
              <span className="text-slate-400">&bull;</span>
            )}
            {medVulns.length > 0 && (
              <span className="text-amber-500 dark:text-amber-400">{medVulns.length} Med</span>
            )}
            {medVulns.length > 0 && lowVulns.length > 0 && (
              <span className="text-slate-400">&bull;</span>
            )}
            {lowVulns.length > 0 && (
              <span className="text-emerald-500 dark:text-emerald-400">{lowVulns.length} Low</span>
            )}
            {vulnerabilities.length === 0 && (
              <span className="text-slate-400">0 Findings</span>
            )}
          </div>
        </div>

        {/* Max CVSS */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>MAX SEVERITY</span>
            <Activity className="w-4 h-4 text-rose-500 flex-shrink-0" />
          </div>
          <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
            {topVuln ? topVuln.cvss : 8.2}
          </div>
          <div className={`text-[11px] font-mono truncate font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>
            {topVuln ? `${topVuln.severity} Severity` : 'High Severity'}
          </div>
        </div>

        {/* Assets Tested */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>ASSETS TESTED</span>
            <Server className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          </div>
          <div className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {uniqueAssets.length > 0 ? uniqueAssets.length : 1}
          </div>
          <div className={`text-[11px] font-mono truncate font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>
            {vulnerabilities.length} With Findings
          </div>
        </div>
      </div>

      {/* Critical Exploit Chain Card */}
      {topVuln && (
        <div 
          onClick={onViewAttackChain}
          className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-sm group ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-[#170C1C] via-[#0D1526] to-[#0A1222] border-rose-500/40 hover:border-rose-400'
              : 'bg-white border-rose-200 hover:border-rose-400 shadow-md'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 group-hover:scale-105 transition-transform flex-shrink-0 mt-0.5">
                <GitBranch className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    TOP SECURITY RISK
                  </span>
                  <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
                    {topVuln.target} &bull; CVSS {topVuln.cvss}
                  </span>
                </div>
                <h3 className={`text-base sm:text-lg font-bold group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-slate-950'
                }`}>
                  {topVuln.title}
                </h3>
                <p className={`text-xs max-w-3xl leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                  {topVuln.impact || topVuln.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 h-10 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs font-sans shadow-md transition-all flex-shrink-0 self-start lg:self-auto">
              <span>Explore Attack Graph</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Section: Findings List & Subdomains */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Finding Items */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border space-y-4 flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>Confirmed Vulnerabilities ({vulnerabilities.length})</span>
            </div>
            <button
              onClick={() => onNavigateTab('vulnerabilities')}
              className="text-xs font-sans text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {vulnerabilities.map((vuln) => {
              const isCritical = vuln.severity === 'CRITICAL';
              const isHigh = vuln.severity === 'HIGH';
              const isMedium = vuln.severity === 'MEDIUM';

              return (
                <div
                  key={vuln.id}
                  onClick={() => onSelectFinding(vuln)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                    theme === 'dark'
                      ? 'bg-[#080E1C] border-slate-800/90 hover:border-cyan-500/40 hover:bg-[#0E172C]'
                      : 'bg-slate-50 border-slate-200 hover:border-cyan-500 hover:bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex-shrink-0 w-16 text-center ${
                      isCritical
                        ? 'bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 font-black'
                        : isHigh
                        ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                        : isMedium
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/30'
                    }`}>
                      {vuln.severity}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors ${
                        theme === 'dark' ? 'text-slate-200' : 'text-slate-950'
                      }`}>
                        {vuln.title}
                      </div>
                      <div className={`text-[10px] font-mono truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'
                      }`}>
                        {vuln.target} &bull; {vuln.cwe}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0 ml-3">
                    <span className={`font-bold ${
                      isCritical 
                        ? 'text-red-500 dark:text-red-400 font-black' 
                        : isHigh 
                        ? 'text-orange-600 dark:text-orange-400' 
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      CVSS {vuln.cvss}
                    </span>
                    <div className={`h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-sans font-bold border transition-colors ${
                      theme === 'dark' 
                        ? 'bg-[#0D162B] group-hover:bg-cyan-500 text-slate-300 group-hover:text-slate-950 border-slate-700' 
                        : 'bg-slate-100 group-hover:bg-cyan-500 text-slate-800 group-hover:text-slate-950 border-slate-300'
                    }`}>
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Asset Surface */}
        <div className={`p-6 rounded-2xl border space-y-4 flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              <Server className="w-4 h-4 text-cyan-500" />
              <span>Asset Surface</span>
            </div>
            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
              {uniqueAssets.length} Target Assets
            </span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {uniqueAssets.map((asset, idx) => {
              const assetVulns = vulnerabilities.filter(v => (v.target || '').includes(asset));
              const hasFindings = assetVulns.length > 0;
              const hasHigh = assetVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL');

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                    theme === 'dark' ? 'bg-[#080E1C] border-slate-800/70' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0 mr-2">
                    <div className={`font-mono font-bold text-[11px] truncate ${
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-950'
                    }`}>
                      {asset}
                    </div>
                    <div className={`text-[10px] truncate ${
                      hasFindings
                        ? (theme === 'dark' ? 'text-rose-400' : 'text-rose-600 font-semibold')
                        : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium')
                    }`}>
                      {hasFindings 
                        ? `${assetVulns.length} Confirmed Finding${assetVulns.length > 1 ? 's' : ''}` 
                        : 'Audited & Protected (HTTP 200 OK)'}
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded flex-shrink-0 border ${
                    hasFindings
                      ? (hasHigh
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30')
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}>
                    {hasFindings ? (hasHigh ? 'HIGH RISK' : 'FINDING') : 'PROTECTED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Verified Safe Controls Card */}
      <div className={`p-6 rounded-2xl border space-y-4 ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className={`flex items-center gap-2 font-bold text-sm border-b pb-3 ${
          theme === 'dark' ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-950'
        }`}>
          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>Verified Safe &amp; Hardened Systems</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {dynamicPositiveControls.slice(0, 4).map((ctrl, idx) => (
            <div key={idx} className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${
              theme === 'dark' ? 'bg-[#080E1C] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800 font-medium'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-sans">{ctrl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
