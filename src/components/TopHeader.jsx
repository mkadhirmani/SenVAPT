import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Radar, 
  Activity, 
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
  theme = 'light', 
  isScanning, 
  onTriggerScan, 
  onOpenLlmSettings,
  onOpenStrixSettings,
  companyName = "",
  targetUrl = "",
  riskLevel = "",
  riskScore = 0
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
      theme === 'dark' ? 'bg-[#001B41]/90 backdrop-blur-md border-[#0A3778]' : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-sm'
    }`}>
      {/* Left: Breadcrumbs & Dynamic Company */}
      <div className="flex items-center gap-2 text-xs font-mono min-w-0 pr-4">
        {companyName && (
          <>
            <span className={`font-heading font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              {companyName}
            </span>
            <span className={theme === 'dark' ? 'text-[#4D5F7A]' : 'text-slate-400'}>/</span>
          </>
        )}
        <span className="font-heading text-[#006FE3] dark:text-[#4D9AEC] font-bold uppercase tracking-wider truncate">
          {getTabTitle()}
        </span>
      </div>

      {/* Right: Action bar */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Target URL Badge (Only when target exists) */}
        {targetUrl && (
          <div className={`hidden md:flex items-center gap-2 px-3 h-9 rounded-xl border text-xs font-mono ${
            theme === 'dark' ? 'bg-[#001127]/80 border-[#0A3778] text-slate-200' : 'bg-[#E6F1FC] border-[#B3D4F7] text-[#001B41] font-medium'
          }`}>
            <Globe className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
            <span className="truncate max-w-[150px] font-semibold">{targetUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        )}

        {/* Risk Posture (Only when risk data exists) */}
        {riskLevel && riskLevel !== 'NONE' && (
          <div className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-mono font-bold border ${
            riskLevel === 'CRITICAL'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
              : riskLevel === 'HIGH'
              ? 'bg-[#B9623C]/15 border-[#B9623C]/30 text-[#B9623C]'
              : 'bg-[#299346]/15 border-[#299346]/30 text-[#299346]'
          }`}>
            <Activity className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
            <span>{riskLevel} {riskScore > 0 ? `(${riskScore}/10)` : ''}</span>
          </div>
        )}

        {/* SSH Server Settings Button (Admin or Permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
          <button
            onClick={onOpenStrixSettings}
            title="Configure Remote Machine SSH Credentials & IP"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
              strixConfig.host
                ? 'bg-[#299346]/15 border-[#299346]/40 text-[#299346] dark:text-emerald-400'
                : theme === 'dark'
                ? 'bg-[#001E4B] hover:bg-[#002863] text-slate-200 border-[#0A3778]'
                : 'bg-slate-100 hover:bg-[#E6F1FC] text-[#001B41] border-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
            <span className="hidden lg:inline">{strixConfig.host ? 'SSH Connected' : 'SSH Server'}</span>
          </button>
        )}

        {/* LLM Key Settings (Admin or Permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
          <button
            onClick={onOpenLlmSettings}
            title="Configure Custom LLM API Key"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#001E4B] hover:bg-[#002863] text-[#4D9AEC] border-[#0A3778] hover:border-[#006FE3]'
                : 'bg-[#E6F1FC] hover:bg-[#B3D4F7] text-[#001B41] border-[#B3D4F7]'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
            <span className="hidden sm:inline">LLM Key</span>
          </button>
        )}

        {/* Scan Target Button (If permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'run_scans')) && (
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-heading font-bold transition-all border cursor-pointer ${
              isScanning
                ? 'bg-[#006FE3] text-white border-[#4D9AEC] animate-pulse'
                : 'bg-[#006FE3] hover:bg-[#005bbd] text-white border-[#006FE3] shadow-md shadow-[#006FE3]/30'
            }`}
          >
            <Radar className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Scan Target'}</span>
          </button>
        )}

        {/* User Account Menu */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-2 px-3 h-9 rounded-xl border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#001E4B] hover:bg-[#002863] border-[#0A3778] text-slate-200'
                  : 'bg-slate-100 hover:bg-[#E6F1FC] border-slate-200 text-[#001B41]'
              }`}
            >
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                isAdmin ? 'bg-[#006FE3]/20 text-[#4D9AEC]' : 'bg-[#299346]/20 text-[#299346]'
              }`}>
                {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1.5 ${
                isAdmin
                  ? 'bg-[#006FE3]/20 text-[#4D9AEC] border-[#006FE3]/30'
                  : 'bg-[#299346]/20 text-[#299346] border-[#299346]/30'
              }`}>
                <span className="truncate max-w-[100px]">{currentUser.username || (isAdmin ? 'admin' : 'user')}</span>
                <span className="opacity-70 text-[9px] font-sans font-normal uppercase">
                  ({isAdmin ? 'Admin' : 'User'})
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div 
                className={`absolute right-0 mt-2 w-56 p-2 rounded-2xl border shadow-xl z-50 animate-fadeIn ${
                  theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778] text-white' : 'bg-white border-slate-200 text-[#001B41] shadow-slate-200'
                }`}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className={`p-2.5 border-b mb-1 ${theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-200'}`}>
                  <div className="text-xs font-heading font-bold text-[#006FE3] dark:text-[#4D9AEC] uppercase tracking-wider truncate">
                    {currentUser.username || currentUser.name || (isAdmin ? 'admin' : 'user')}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {isAdmin ? 'Administrator (Full Privileges)' : 'Standard User Account'}
                  </div>
                  {currentUser.email && (
                    <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                      {currentUser.email}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-heading font-bold text-[#006FE3] dark:text-[#4D9AEC] hover:bg-[#006FE3]/10 flex items-center gap-2 transition-colors cursor-pointer"
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
                  className="w-full px-3 py-2 rounded-xl text-left text-xs font-heading font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
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
