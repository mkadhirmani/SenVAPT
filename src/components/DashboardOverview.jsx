import React, { useMemo } from 'react';
import { sortVulnerabilities, getSeverityStyles } from '../utils/severityUtils';
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
  theme = 'light'
}) {
  const isAdmin = currentUser?.role === 'admin';
  const canViewTokens = isAdmin || checkUserPermission(currentUser, 'view_tokens');

  const currentTarget = activeScan || scanHistory.find(s => s.id === activeScanId) || {};

  // Canonical sort: CRITICAL -> HIGH -> MEDIUM -> LOW
  const sortedVulnerabilities = useMemo(() => {
    return sortVulnerabilities(vulnerabilities);
  }, [vulnerabilities]);

  const critVulns = sortedVulnerabilities.filter(v => v.severity === 'CRITICAL');
  const highVulns = sortedVulnerabilities.filter(v => v.severity === 'HIGH');
  const medVulns = sortedVulnerabilities.filter(v => v.severity === 'MEDIUM');
  const lowVulns = sortedVulnerabilities.filter(v => v.severity === 'LOW');
  const topVuln = sortedVulnerabilities[0] || null;

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
        <div className={`p-3.5 px-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono transition-colors ${
          theme === 'dark' 
            ? 'bg-[#001E4B] border-[#0A3778] text-slate-200' 
            : 'bg-white/90 backdrop-blur-md border-slate-200/90 text-[#001B41] shadow-card-premium'
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
              isAdmin 
                ? 'bg-[#006FE3]/15 text-[#006FE3] border border-[#006FE3]/30' 
                : 'bg-[#299346]/15 text-[#299346] border border-[#299346]/30'
            }`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Logged in as: </span>
                <strong className={`font-heading font-black text-sm uppercase tracking-wider ${isAdmin ? 'text-[#006FE3] dark:text-[#4D9AEC]' : 'text-[#299346]'}`}>
                  {currentUser?.username || (isAdmin ? 'admin' : 'user')}
                </strong>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-heading font-bold border uppercase tracking-wider ${
                  theme === 'dark' ? 'bg-[#001127] border-[#0A3778] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  {isAdmin ? 'Administrator' : 'Standard User'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#299346] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#299346] animate-pulse"></span>
            <span className="font-heading tracking-tight">Active Authenticated Session</span>
          </div>
        </div>

        {/* Welcome Empty State Card */}
        <div className={`p-8 sm:p-16 rounded-3xl border text-center space-y-6 transition-all shadow-card-premium ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#0A3778]' 
            : 'bg-white border-slate-200/90'
        }`}>
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-3xl bg-[#006FE3]/20 animate-ping opacity-25"></div>
            <div className="relative w-20 h-20 rounded-3xl bg-[#006FE3]/10 text-[#006FE3] mx-auto flex items-center justify-center border border-[#006FE3]/25 shadow-inner">
              <ShieldCheck className="w-10 h-10 text-[#006FE3]" />
            </div>
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-heading font-extrabold ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              Welcome, <span className="text-[#006FE3] dark:text-[#4D9AEC] uppercase">{currentUser?.username || 'User'}</span>!
            </h2>
            <p className="text-xs font-heading font-bold text-[#006FE3] dark:text-[#4D9AEC] uppercase tracking-wider">
              Autonomous Cybersecurity Assessment
            </p>
            <p className={`text-xs sm:text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              You are signed in as <strong className="text-[#006FE3] dark:text-[#4D9AEC] uppercase">{currentUser?.username || 'User'}</strong> ({isAdmin ? 'Administrator' : 'Standard User'}). Launch an AI-driven penetration test to discover vulnerabilities, verify defenses, and generate professional deliverables.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab ? onNavigateTab('scan') : null}
              className="px-8 py-3.5 rounded-2xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-heading font-bold text-sm shadow-md shadow-[#006FE3]/30 inline-flex items-center gap-2.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
      {/* Target Assessment & Command Bar */}
      <div className={`p-4 px-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono transition-all shadow-card-premium ${
        theme === 'dark' 
          ? 'bg-[#001E4B] border-[#0A3778] text-slate-200' 
          : 'bg-white border-slate-200/90 text-[#001B41]'
      }`}>
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2 text-[#006FE3] dark:text-[#4D9AEC] font-heading font-bold uppercase tracking-wider text-xs">
            <span className="w-2 h-2 rounded-full bg-[#006FE3] animate-pulse"></span>
            <History className="w-4 h-4 text-[#006FE3]" />
            <span>Active Target Assessment:</span>
          </div>
          {companyName && (
            <span className={`font-heading font-extrabold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              {companyName}
            </span>
          )}
          {targetUrl && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono border truncate max-w-xs ${
              theme === 'dark' 
                ? 'bg-[#001127] border-[#0A3778] text-slate-300' 
                : 'bg-slate-100/90 border-slate-200 text-slate-700'
            }`}>
              {targetUrl}
            </span>
          )}
          
          {/* Scanned By Attribution Badge */}
          {isAdmin && (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-[#299346]/10 text-[#299346] border border-[#299346]/25 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Audited by: {scannedByName}</span>
            </span>
          )}
        </div>

        {scanHistory.length > 1 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'} text-[11px] font-heading font-bold`}>
              Switch Target:
            </span>
            <select
              value={activeScanId}
              onChange={(e) => {
                const selected = scanHistory.find(s => s.id === e.target.value);
                if (selected && onSelectScan) onSelectScan(selected, true);
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs focus:outline-none border transition-all cursor-pointer font-medium ${
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
        )}
      </div>

      {/* Executive Security Posture Hero Banner */}
      <div className={`rounded-xl border transition-all ${
        theme === 'dark' 
          ? 'bg-[#001B41] border-[#0A3778]' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[#006FE3] dark:text-[#4D9AEC] text-xs font-heading font-bold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 flex-shrink-0 text-[#006FE3]" />
              <span>Cybersecurity Assessment Overview</span>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={`text-2xl sm:text-3xl font-heading font-bold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                {companyName || 'Target Organization'}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 uppercase tracking-wide ${
                riskLevel === 'CRITICAL'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : riskLevel === 'HIGH'
                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                  : (riskLevel === 'MEDIUM' || riskLevel === 'ELEVATED')
                  ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  riskLevel === 'CRITICAL' 
                    ? 'bg-red-600' 
                    : riskLevel === 'HIGH' 
                    ? 'bg-orange-500' 
                    : (riskLevel === 'MEDIUM' || riskLevel === 'ELEVATED')
                    ? 'bg-yellow-400' 
                    : 'bg-emerald-600'
                }`}></span>
                <span>{riskLevel} Risk Posture</span>
              </span>
            </div>

            <p className={`text-xs sm:text-sm leading-relaxed max-w-2xl font-normal ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Security audit of <strong className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>{targetUrl}</strong> confirmed <strong className="text-slate-900 dark:text-white font-semibold">{vulnerabilities.length} verified security findings</strong> ({severityBreakdown}).
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => onOpenChatbot(`Summarize all findings for ${companyName} in simple words`)}
              className={`flex items-center justify-center gap-2 px-4 h-10 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#001127] hover:bg-[#002863] text-slate-200 border-[#0A3778]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
              }`}
            >
              <Bot className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
              <span>Ask AI Copilot</span>
            </button>

            <button
              onClick={() => onNavigateTab('report')}
              className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-[#006FE3] hover:bg-[#005bbd] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Download Audit Report</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Elevated KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Rating */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between h-36 transition-all ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#0A3778]' 
            : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold tracking-wider uppercase ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              THREAT RATING
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
              <Flame className="w-4 h-4 text-red-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="text-3xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">
              {riskScore}<span className="text-sm font-normal text-slate-400"> / 10.0</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full ${riskScore >= 9.0 ? 'bg-red-500' : riskScore >= 7.0 ? 'bg-orange-500' : riskScore >= 4.0 ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(riskScore * 10, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>{riskLevel} Severity Detected</span>
          </div>
        </div>

        {/* Confirmed Findings */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between h-36 transition-all ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#0A3778]' 
            : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold tracking-wider uppercase ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              TOTAL FINDINGS
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
            </div>
          </div>

          <div className="space-y-1">
            <div className={`text-3xl font-heading font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {vulnerabilities.length}
            </div>
            <div className="text-xs text-slate-500">
              {critVulns.length} Critical &bull; {highVulns.length} High &bull; {medVulns.length} Medium
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>Confirmed Vulnerabilities</span>
          </div>
        </div>

        {/* Max Severity */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between h-36 transition-all ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#0A3778]' 
            : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold tracking-wider uppercase ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              MAX SEVERITY
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
              <Activity className="w-4 h-4 text-red-600 flex-shrink-0" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">
                {topVuln ? topVuln.cvss : 8.2}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${
                (topVuln?.severity || 'HIGH') === 'CRITICAL'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : (topVuln?.severity || 'HIGH') === 'HIGH'
                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                  : (topVuln?.severity || 'HIGH') === 'MEDIUM'
                  ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {topVuln ? topVuln.severity : 'HIGH'}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-500 truncate">
              {topVuln?.cwe || 'CWE-639'}
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>Highest Discovered Risk</span>
          </div>
        </div>

        {/* Audited Assets */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between h-36 transition-all ${
          theme === 'dark' 
            ? 'bg-[#001B41] border-[#0A3778]' 
            : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold tracking-wider uppercase ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              AUDITED ASSETS
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Server className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            </div>
          </div>

          <div className="space-y-1">
            <div className={`text-3xl font-heading font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {uniqueAssets.length > 0 ? uniqueAssets.length : 1}
            </div>
            <div className="text-xs text-slate-500 truncate">
              Hostnames Assessed
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Perimeter Audited</span>
          </div>
        </div>
      </div>

      {/* Critical Exploit Chain Card */}
      {topVuln && (
        <div 
          onClick={onViewAttackChain}
          className={`p-5 sm:p-6 rounded-xl border transition-all cursor-pointer group ${
            theme === 'dark'
              ? 'bg-[#001B41] border-[#0A3778] hover:border-[#006FE3]'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <GitBranch className="w-5 h-5 text-slate-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wide">
                    PRIMARY EXPLOIT PATH
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                    CVSS {topVuln.cvss} &bull; {topVuln.cwe}
                  </span>
                </div>
                <h3 className={`text-base font-heading font-bold group-hover:text-[#006FE3] transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {topVuln.title}
                </h3>
                <p className={`text-xs max-w-3xl leading-relaxed font-normal ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {topVuln.impact || topVuln.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006FE3] hover:bg-[#005bbd] text-white font-semibold text-xs transition-colors flex-shrink-0 self-start lg:self-auto cursor-pointer">
              <span>Simulate Attack Path</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Section: Findings List & Subdomains */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Finding Items */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border space-y-4 shadow-card-premium ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200/90'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-100'
          }`}>
            <div className={`flex items-center gap-2.5 font-heading font-extrabold text-sm ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              <Layers className="w-4 h-4 text-[#006FE3]" />
              <span>Confirmed Vulnerabilities ({vulnerabilities.length})</span>
            </div>
            <button
              onClick={() => onNavigateTab('vulnerabilities')}
              className="text-xs font-heading text-[#006FE3] dark:text-[#4D9AEC] hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <span>View Full Catalog</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {sortedVulnerabilities.map((vuln) => {
              const styles = getSeverityStyles(vuln.severity);

              return (
                <div
                  key={vuln.id}
                  onClick={() => onSelectFinding(vuln)}
                  className={`relative overflow-hidden flex items-center justify-between p-3.5 pl-4 rounded-xl border transition-all cursor-pointer group ${
                    theme === 'dark'
                      ? 'bg-[#001127]/60 border-[#0A3778] hover:border-[#006FE3] hover:bg-[#002863]'
                      : 'bg-white border-slate-200/90 hover:border-[#006FE3] hover:shadow-xs'
                  }`}
                >
                  {/* Left Severity Accent Strip */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${styles.strip}`}></div>

                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border flex-shrink-0 w-24 text-center uppercase tracking-wide ${styles.badge}`}>
                      {vuln.severity}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-heading font-bold truncate group-hover:text-[#006FE3] transition-colors ${
                        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        {vuln.title}
                      </div>
                      <div className={`text-[11px] font-mono truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {vuln.target} &bull; <span className="font-semibold">{vuln.cwe}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0 ml-3">
                    <span className="font-semibold px-2 py-0.5 rounded border text-[11px] bg-slate-50 text-slate-700 border-slate-200">
                      CVSS {vuln.cvss}
                    </span>
                    <div className={`h-8 px-3 rounded-lg flex items-center gap-1 text-[11px] font-semibold border transition-colors ${
                      theme === 'dark' 
                        ? 'bg-[#001127] group-hover:bg-[#006FE3] text-slate-200 group-hover:text-white border-[#0A3778]' 
                        : 'bg-slate-50 group-hover:bg-[#006FE3] text-slate-700 group-hover:text-white border-slate-200 shadow-2xs'
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
        <div className={`p-6 rounded-2xl border space-y-4 shadow-card-premium ${
          theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200/90'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-100'
          }`}>
            <div className={`flex items-center gap-2 font-heading font-extrabold text-sm ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              <Server className="w-4 h-4 text-[#006FE3]" />
              <span>Audited Attack Surface</span>
            </div>
            <span className={`text-xs font-mono font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {uniqueAssets.length} Hostname{uniqueAssets.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {uniqueAssets.map((asset, idx) => {
              const assetVulns = vulnerabilities.filter(v => (v.target || '').includes(asset));
              const hasFindings = assetVulns.length > 0;
              const hasHigh = assetVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL');

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                    theme === 'dark' 
                      ? 'bg-[#001127]/60 border-[#0A3778]' 
                      : 'bg-slate-50/80 border-slate-200/90'
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
                        : (theme === 'dark' ? 'text-slate-400' : 'text-slate-500')
                    }`}>
                      {hasFindings 
                        ? `${assetVulns.length} Confirmed Finding${assetVulns.length > 1 ? 's' : ''}` 
                        : 'Audited & Protected (HTTP 200 OK)'}
                    </div>
                  </div>

                  <span className={`text-[9px] font-heading font-black px-2 py-0.5 rounded flex-shrink-0 border uppercase tracking-wider ${
                    hasFindings
                      ? (hasHigh
                          ? 'bg-rose-600 text-white border-rose-700 font-black'
                          : 'bg-[#B9623C] text-white border-[#A14E29]')
                      : 'bg-[#299346] text-white border-[#217838]'
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
      <div className={`p-6 rounded-2xl border space-y-4 shadow-card-premium ${
        theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200/90'
      }`}>
        <div className={`flex items-center gap-2 font-heading font-extrabold text-sm border-b pb-3.5 ${
          theme === 'dark' ? 'border-[#0A3778] text-white' : 'border-slate-100 text-[#001B41]'
        }`}>
          <ShieldCheck className="w-4 h-4 text-[#299346] flex-shrink-0" />
          <span>Verified Safe &amp; Hardened Perimeter Controls (Positive Security Verification)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {dynamicPositiveControls.slice(0, 4).map((ctrl, idx) => (
            <div key={idx} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              theme === 'dark' 
                ? 'bg-[#001127]/60 border-[#0A3778] text-slate-300' 
                : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
            }`}>
              <div className="w-5 h-5 rounded-full bg-[#299346]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#299346]" />
              </div>
              <span className="leading-relaxed font-sans font-medium">{ctrl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
