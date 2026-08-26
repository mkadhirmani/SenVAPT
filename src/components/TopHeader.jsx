import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Radar, 
  Activity, 
  Sun, 
  Moon, 
  Key,
  Server,
  User,
  LogOut,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import { SCAN_METADATA } from '../data/scanData';
import { getStrixServerConfig } from '../utils/strixApi';
import { checkUserPermission } from '../utils/auth';

export default function TopHeader({ 
  activeTab, 
  setActiveTab, 
  currentUser,
  onLogout,
  theme, 
  toggleTheme, 
  isScanning, 
  onTriggerScan, 
  onOpenLlmSettings,
  onOpenStrixSettings,
  companyName = "Vontier Corporation",
  targetUrl = SCAN_METADATA.targetUrl,
  riskLevel = SCAN_METADATA.overallRiskLevel,
  riskScore = SCAN_METADATA.overallRiskScore
}) {
  const [strixConfig, setStrixConfig] = useState(() => getStrixServerConfig());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    setStrixConfig(getStrixServerConfig());
  }, []);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Security Overview';
      case 'scan': return 'AI Target Scanner';
      case 'history': return 'Scan History';
      case 'vulnerabilities': return 'Vulnerability Findings';
      case 'attack-chain': return 'Attack Graph';
      case 'chatbot': return 'AI Security Assistant';
      case 'report': return 'VAPT Deliverable Report';
      case 'admin': return 'Admin Portal & User Management';
      default: return 'Security Portal';
    }
  };

  return (
    <header className={`h-16 border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#090E1A]/95 backdrop-blur-md border-slate-800' : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-sm'
    }`}>
      {/* Left: Breadcrumbs & Dynamic Company */}
      <div className="flex items-center gap-2 text-xs font-mono min-w-0 pr-4">
        <span className={`font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
          {companyName}
        </span>
        <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>/</span>
        <span className="text-cyan-600 dark:text-cyan-400 font-bold uppercase truncate">{getTabTitle()}</span>
      </div>

      {/* Right: Action bar */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Target URL Badge */}
        <div className={`hidden md:flex items-center gap-2 px-3 h-9 rounded-xl border text-xs font-mono ${
          theme === 'dark' ? 'bg-[#0D1527] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800 font-medium'
        }`}>
          <Globe className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
          <span className="truncate max-w-[150px] font-semibold">{targetUrl.replace('https://', '')}</span>
        </div>

        {/* Risk Posture */}
        <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold">
          <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse flex-shrink-0" />
          <span>{riskLevel} ({riskScore}/10)</span>
        </div>

        {/* SSH Server Settings Button (Admin or Permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
          <button
            onClick={onOpenStrixSettings}
            title="Configure Remote Machine SSH Credentials & IP"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-mono font-bold transition-all border ${
              strixConfig.host
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : theme === 'dark'
                ? 'bg-[#0E1A33] hover:bg-[#132448] text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
            <span className="hidden lg:inline">{strixConfig.host ? 'SSH Connected' : 'SSH Server'}</span>
          </button>
        )}

        {/* LLM Key Settings (Admin or Permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
          <button
            onClick={onOpenLlmSettings}
            title="Configure Custom LLM API Key"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-mono font-bold transition-all border ${
              theme === 'dark'
                ? 'bg-[#0E1A33] hover:bg-[#132448] text-cyan-300 border-cyan-800/80 hover:border-cyan-500/50'
                : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
            <span className="hidden sm:inline">LLM Key</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Light / Dark Theme"
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
            theme === 'dark'
              ? 'bg-[#0D1527] border-slate-800 text-cyan-400 hover:bg-slate-800'
              : 'bg-slate-100 border-slate-300 text-amber-600 hover:bg-slate-200'
          }`}
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Scan Target Button (If permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'run_scans')) && (
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-bold font-mono transition-all border ${
              isScanning
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-sm'
            }`}
          >
            <Radar className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Scan Link'}</span>
          </button>
        )}

        {/* User Account Menu */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-2 px-3 h-9 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'bg-[#0D1527] hover:bg-[#121E38] border-slate-800 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                isAdmin ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isAdmin
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {isAdmin ? 'ADMIN' : 'USER'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div 
                className={`absolute right-0 mt-2 w-52 p-2 rounded-2xl border shadow-xl z-50 animate-fadeIn ${
                  theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
                }`}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="p-2.5 border-b border-slate-800 mb-1">
                  <div className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                    {isAdmin ? 'Administrator' : 'Standard User'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {isAdmin ? 'Full Root Privileges' : 'Client Safe View'}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Portal</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

