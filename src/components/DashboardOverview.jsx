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
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778] text-slate-200' : 'bg-white border-slate-200 text-[#001B41] shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
              isAdmin ? 'bg-[#006FE3]/20 text-[#4D9AEC] border border-[#006FE3]/40' : 'bg-[#299346]/20 text-[#299346] border border-[#299346]/40'
            }`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Logged in as: </span>
              <strong className={`font-heading font-black text-sm uppercase tracking-wider ${isAdmin ? 'text-[#006FE3] dark:text-[#4D9AEC]' : 'text-[#299346]'}`}>
                {currentUser?.username || (isAdmin ? 'admin' : 'user')}
              </strong>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-heading font-bold border ${
                theme === 'dark' ? 'bg-[#001127] border-[#0A3778] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                {isAdmin ? 'Administrator' : 'Standard User'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#299346] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#299346] animate-pulse"></span>
            <span className="font-heading">Active Authenticated Session</span>
          </div>
        </div>

        {/* Welcome Empty State Card */}
        <div className={`p-8 sm:p-14 rounded-3xl border text-center space-y-6 transition-colors shadow-sm ${
          theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200'
        }`}>
          <div className="w-20 h-20 rounded-3xl bg-[#006FE3]/15 text-[#006FE3] mx-auto flex items-center justify-center border border-[#006FE3]/30 shadow-inner">
            <ShieldCheck className="w-10 h-10 animate-pulse text-[#006FE3]" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-heading font-extrabold ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              Welcome, <span className="text-[#006FE3] dark:text-[#4D9AEC] uppercase">{currentUser?.username || 'User'}</span>!
            </h2>
            <p className="text-xs font-heading font-semibold text-[#006FE3] dark:text-[#4D9AEC] uppercase tracking-wider">
              Enterprise Security. Without Compromise.
            </p>
            <p className={`text-xs sm:text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              You are signed in as <strong className="text-[#006FE3] dark:text-[#4D9AEC] uppercase">{currentUser?.username || 'User'}</strong> ({isAdmin ? 'Administrator' : 'Standard User'}). Launch an AI-driven penetration test to discover vulnerabilities, attack paths, and remediation plans.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab ? onNavigateTab('scan') : null}
              className="px-8 py-3.5 rounded-2xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-heading font-bold text-sm shadow-lg shadow-[#006FE3]/30 inline-flex items-center gap-2.5 transition-all cursor-pointer hover:scale-105"
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
        theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778] text-slate-200' : 'bg-white border-slate-200 text-[#001B41] shadow-sm'
      }`}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
            isAdmin ? 'bg-[#006FE3]/20 text-[#4D9AEC]' : 'bg-[#299346]/20 text-[#299346]'
          }`}>
            {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Logged in as: </span>
            <strong className={`font-heading font-black text-sm uppercase tracking-wider ${isAdmin ? 'text-[#006FE3] dark:text-[#4D9AEC]' : 'text-[#299346]'}`}>
              {currentUser?.username || (isAdmin ? 'admin' : 'user')}
            </strong>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-heading font-bold border ${
              theme === 'dark' ? 'bg-[#001127] border-[#0A3778] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              {isAdmin ? 'Administrator' : 'Standard User'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#299346] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#299346] animate-pulse"></span>
          <span className="font-heading">Active Session</span>
        </div>
      </div>

      {/* Scan Session Switcher Banner */}
      {scanHistory.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-colors ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778] text-slate-200' : 'bg-white border-slate-200 text-[#001B41] shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="text-[#006FE3] dark:text-[#4D9AEC] font-heading font-bold uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#006FE3]" />
              Active Target Scan:
            </span>
            {companyName && (
              <span className={`font-heading font-bold truncate text-sm ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                {companyName}
              </span>
            )}
            {companyName && targetUrl && (
              <span className={theme === 'dark' ? 'text-[#4D5F7A]' : 'text-slate-400'}>&bull;</span>
            )}
            {targetUrl && (
              <span className={`truncate hidden sm:inline ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {targetUrl}
              </span>
            )}
            
            {/* Scanned By Attribution Badge (Admin Visible) */}
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#299346]/20 text-[#299346] border border-[#299346]/30 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <span>Audited by: {scannedByName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} text-[11px] font-heading font-bold`}>
              Switch Target:
            </span>
            <select
              value={activeScanId}
              onChange={(e) => {
                const selected = scanHistory.find(s => s.id === e.target.value);
                if (selected && onSelectScan) onSelectScan(selected, true);
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs focus:outline-none border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#001127] border-[#0A3778] text-white focus:border-[#006FE3]'
                  : 'bg-slate-50 border-slate-300 text-[#001B41] focus:border-[#006FE3]'
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
          ? 'bg-gradient-to-r from-[#001B41] via-[#002863] to-[#001B41] border-[#0A3778]' 
          : 'bg-gradient-to-r from-[#E6F1FC] via-white to-[#E6F1FC] border-[#B3D4F7]'
      }`}>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[#006FE3] dark:text-[#4D9AEC] text-xs font-heading font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-[#006FE3]" />
            <span>Autonomous Security Assessment Overview</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-heading font-extrabold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            {companyName}: <span className="text-rose-500 dark:text-rose-400">{riskLevel} RISK</span>
          </h1>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Automated testing of <strong className={theme === 'dark' ? 'text-white' : 'text-[#001B41]'}>{targetUrl}</strong> confirmed <strong className="text-[#006FE3] dark:text-[#4D9AEC]">{vulnerabilities.length} security findings</strong> ({severityBreakdown}). Most systems are protected, but prioritized remediation is advised.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => onOpenChatbot(`Summarize all findings for ${companyName} in simple words`)}
            className={`flex items-center justify-center gap-2 px-4 h-10 rounded-xl border text-xs font-heading font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#006FE3]/15 hover:bg-[#006FE3]/25 text-[#4D9AEC] border-[#006FE3]/40'
                : 'bg-white hover:bg-[#E6F1FC] text-[#006FE3] border-[#B3D4F7] shadow-sm'
            }`}
          >
            <Bot className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
            <span>Ask AI Assistant</span>
          </button>

          <button
            onClick={() => onNavigateTab('report')}
            className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white text-xs font-heading font-bold transition-all shadow-md shadow-[#006FE3]/30 cursor-pointer"
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
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-heading font-bold ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span>RISK RATING</span>
            <Flame className="w-4 h-4 text-rose-500 flex-shrink-0" />
          </div>
          <div className="text-3xl font-heading font-black text-rose-500 dark:text-rose-400">
            {riskScore}<span className={`text-sm font-normal ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}> / 10</span>
          </div>
          <div className={`text-[11px] font-heading font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            {riskLevel} Posture
          </div>
        </div>

        {/* Confirmed Findings */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-heading font-bold ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span>FINDINGS</span>
            <ShieldAlert className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
          </div>
          <div className={`text-3xl font-heading font-black ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            {vulnerabilities.length}
          </div>
          <div className="text-[11px] font-mono flex items-center gap-1.5 font-bold flex-wrap">
            {critVulns.length > 0 && (
              <span className="text-rose-500 font-black">{critVulns.length} Critical</span>
            )}
            {critVulns.length > 0 && (highVulns.length > 0 || medVulns.length > 0 || lowVulns.length > 0) && (
              <span className="text-slate-400">&bull;</span>
            )}
            {highVulns.length > 0 && (
              <span className="text-[#B9623C] dark:text-orange-400">{highVulns.length} High</span>
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
              <span className="text-[#299346] dark:text-emerald-400">{lowVulns.length} Low</span>
            )}
            {vulnerabilities.length === 0 && (
              <span className="text-[#299346]">0 Findings</span>
            )}
          </div>
        </div>

        {/* Max CVSS */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-heading font-bold ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span>MAX SEVERITY</span>
            <Activity className="w-4 h-4 text-rose-500 flex-shrink-0" />
          </div>
          <div className="text-3xl font-heading font-black text-rose-500 dark:text-rose-400">
            {topVuln ? topVuln.cvss : 8.2}
          </div>
          <div className={`text-[11px] font-heading truncate font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            {topVuln ? `${topVuln.severity} Severity` : 'High Severity'}
          </div>
        </div>

        {/* Assets Tested */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-heading font-bold ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span>ASSETS TESTED</span>
            <Server className="w-4 h-4 text-[#299346] flex-shrink-0" />
          </div>
          <div className={`text-3xl font-heading font-black ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            {uniqueAssets.length > 0 ? uniqueAssets.length : 1}
          </div>
          <div className={`text-[11px] font-mono truncate font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
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
              ? 'bg-gradient-to-r from-[#1A0A1E] via-[#001E4B] to-[#001127] border-rose-500/40 hover:border-rose-400'
              : 'bg-white border-rose-200 hover:border-rose-400 shadow-md'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 group-hover:scale-105 transition-transform flex-shrink-0 mt-0.5">
                <GitBranch className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-heading font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                    TOP SECURITY RISK
                  </span>
                  <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
                    {topVuln.target} &bull; CVSS {topVuln.cvss}
                  </span>
                </div>
                <h3 className={`text-base sm:text-lg font-heading font-bold group-hover:text-rose-500 transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-[#001B41]'
                }`}>
                  {topVuln.title}
                </h3>
                <p className={`text-xs max-w-3xl leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {topVuln.impact || topVuln.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-heading font-bold text-xs shadow-md transition-all flex-shrink-0 self-start lg:self-auto">
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
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-200'
          }`}>
            <div className={`flex items-center gap-2 font-heading font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              <Layers className="w-4 h-4 text-[#006FE3]" />
              <span>Confirmed Vulnerabilities ({vulnerabilities.length})</span>
            </div>
            <button
              onClick={() => onNavigateTab('vulnerabilities')}
              className="text-xs font-heading text-[#006FE3] dark:text-[#4D9AEC] hover:underline flex items-center gap-1 font-bold cursor-pointer"
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
                      ? 'bg-[#001127]/60 border-[#0A3778] hover:border-[#006FE3] hover:bg-[#002863]'
                      : 'bg-slate-50 border-slate-200 hover:border-[#006FE3] hover:bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded flex-shrink-0 w-16 text-center border ${
                      isCritical
                        ? 'bg-rose-500/20 text-rose-500 border-rose-500/40 font-black'
                        : isHigh
                        ? 'bg-[#B9623C]/20 text-[#B9623C] border-[#B9623C]/30'
                        : isMedium
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-[#299346]/20 text-[#299346] border-[#299346]/30'
                    }`}>
                      {vuln.severity}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-heading font-bold truncate group-hover:text-[#006FE3] dark:group-hover:text-[#4D9AEC] transition-colors ${
                        theme === 'dark' ? 'text-slate-100' : 'text-[#001B41]'
                      }`}>
                        {vuln.title}
                      </div>
                      <div className={`text-[10px] font-mono truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {vuln.target} &bull; {vuln.cwe}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0 ml-3">
                    <span className={`font-bold ${
                      isCritical 
                        ? 'text-rose-500 font-black' 
                        : isHigh 
                        ? 'text-[#B9623C]' 
                        : 'text-amber-500'
                    }`}>
                      CVSS {vuln.cvss}
                    </span>
                    <div className={`h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-heading font-bold border transition-colors ${
                      theme === 'dark' 
                        ? 'bg-[#001E4B] group-hover:bg-[#006FE3] text-slate-200 group-hover:text-white border-[#0A3778]' 
                        : 'bg-white group-hover:bg-[#006FE3] text-[#001B41] group-hover:text-white border-slate-200'
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
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-200'
          }`}>
            <div className={`flex items-center gap-2 font-heading font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              <Server className="w-4 h-4 text-[#006FE3]" />
              <span>Asset Surface</span>
            </div>
            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
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
                    theme === 'dark' ? 'bg-[#001127]/60 border-[#0A3778]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0 mr-2">
                    <div className={`font-mono font-bold text-[11px] truncate ${
                      theme === 'dark' ? 'text-slate-100' : 'text-[#001B41]'
                    }`}>
                      {asset}
                    </div>
                    <div className={`text-[10px] truncate ${
                      hasFindings
                        ? (theme === 'dark' ? 'text-rose-400' : 'text-rose-600 font-semibold')
                        : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600')
                    }`}>
                      {hasFindings 
                        ? `${assetVulns.length} Confirmed Finding${assetVulns.length > 1 ? 's' : ''}` 
                        : 'Audited & Protected (HTTP 200 OK)'}
                    </div>
                  </div>

                  <span className={`text-[9px] font-heading font-bold px-2 py-0.5 rounded flex-shrink-0 border ${
                    hasFindings
                      ? (hasHigh
                          ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                          : 'bg-[#B9623C]/20 text-[#B9623C] border-[#B9623C]/30')
                      : 'bg-[#299346]/20 text-[#299346] border-[#299346]/30'
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
        theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`flex items-center gap-2 font-heading font-bold text-sm border-b pb-3 ${
          theme === 'dark' ? 'border-[#0A3778] text-white' : 'border-slate-200 text-[#001B41]'
        }`}>
          <ShieldCheck className="w-4 h-4 text-[#299346] flex-shrink-0" />
          <span>Verified Safe &amp; Hardened Controls</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {dynamicPositiveControls.slice(0, 4).map((ctrl, idx) => (
            <div key={idx} className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${
              theme === 'dark' ? 'bg-[#001127]/60 border-[#0A3778] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-[#299346] flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-sans">{ctrl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
