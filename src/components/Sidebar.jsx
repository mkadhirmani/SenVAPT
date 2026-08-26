import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { 
  LayoutDashboard, 
  Radar, 
  ShieldAlert, 
  GitBranch, 
  Bot, 
  FileText, 
  Download, 
  FolderOpen, 
  Sun, 
  Moon, 
  Sparkles, 
  History, 
  Building, 
  Key, 
  Server,
  Users,
  User,
  LogOut,
  Shield,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { SCAN_METADATA } from '../data/scanData';
import { getStrixServerConfig } from '../utils/strixApi';
import { checkUserPermission } from '../utils/auth';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser,
  onLogout,
  theme, 
  toggleTheme, 
  isScanning, 
  onTriggerScan, 
  onExportPdf, 
  onOpenDataLoader,
  onOpenLlmSettings,
  onOpenStrixSettings,
  vulnerabilitiesCount = 7,
  scanHistoryCount = 2,
  companyName = "Vontier Corporation",
  targetUrl = "https://www.vontier.com/",
  riskLevel = "ELEVATED"
}) {
  const [strixConfig, setStrixConfig] = useState(() => getStrixServerConfig());
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    setStrixConfig(getStrixServerConfig());
  }, []);

  const mainNav = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'AI Target Scanner', icon: Radar, badge: isScanning ? 'RUNNING' : null },
    { id: 'history', label: 'Scan History', icon: History, count: scanHistoryCount },
    { id: 'vulnerabilities', label: 'Findings & Vulns', icon: ShieldAlert, count: vulnerabilitiesCount },
    { id: 'attack-chain', label: 'Attack Graph', icon: GitBranch },
  ];

  const aiNav = [
    { id: 'chatbot', label: 'AI Security Assistant', icon: Bot, isNew: true },
  ];

  const reportNav = [
    { id: 'report', label: 'VAPT PDF Report', icon: FileText },
  ];

  return (
    <aside className={`w-64 border-r flex flex-col justify-between flex-shrink-0 min-h-screen select-none transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#090E1A] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Top Brand Area */}
      <div className={`p-5 border-b space-y-4 ${
        theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className="cursor-pointer" onClick={() => setActiveTab('overview')}>
          <Logo theme={theme} size="md" />
        </div>

        {/* Dynamic Company & Target Status Pill */}
        <div className={`p-2.5 rounded-xl border flex flex-col gap-1 text-[11px] font-mono ${
          theme === 'dark' ? 'bg-[#0D1527] border-slate-800' : 'bg-slate-50 border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-bold truncate text-xs ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
              {companyName}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              {riskLevel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 truncate text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            <span className="truncate">{targetUrl.replace('https://', '').replace('/', '')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Admin Navigation Section (Admin Only) */}
        {isAdmin && (
          <div className="space-y-1">
            <div className={`px-3 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 text-cyan-400 flex items-center justify-between`}>
              <span>Administration</span>
              <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">ROOT</span>
            </div>
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-sm font-bold ring-1 ring-cyan-500/30'
                  : theme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  : 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'admin' ? 'text-cyan-400' : 'text-cyan-500'}`} />
                <span className="truncate font-bold">Admin Portal</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                USERS
              </span>
            </button>
          </div>
        )}

        {/* Operations */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            Operations
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-sm font-bold'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-500' : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0 ${
                    item.id === 'history' 
                      ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/40'
                  }`}>
                    {item.count}
                  </span>
                )}

                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 animate-pulse flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* AI Assistant */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            AI Assistant {isAdmin ? '& Backend' : ''}
          </div>
          {aiNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-sm font-bold'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-500' : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                <span className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 flex-shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  LLM
                </span>
              </button>
            );
          })}

          {/* Remote SSH Server Settings (Admin or Permitted) */}
          {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
            <button
              onClick={onOpenStrixSettings}
              className={`w-full h-9 flex items-center gap-3 px-3 rounded-xl text-xs font-mono font-medium transition-all border ${
                strixConfig.host
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                  : theme === 'dark'
                  ? 'bg-[#0B1224] hover:bg-[#121E38] text-slate-300 border-slate-800 hover:border-cyan-500/40'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <span className="truncate">
                {strixConfig.host ? `SSH: ${strixConfig.host}` : 'Remote SSH Server'}
              </span>
            </button>
          )}

          {/* AI Settings / Key configuration (Admin or Permitted) */}
          {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
            <button
              onClick={onOpenLlmSettings}
              className={`w-full h-9 flex items-center gap-3 px-3 rounded-xl text-xs font-mono font-medium transition-all border ${
                theme === 'dark'
                  ? 'bg-[#0B1224] hover:bg-[#121E38] text-cyan-300 border-slate-800 hover:border-cyan-500/40'
                  : 'bg-slate-50 hover:bg-slate-100 text-cyan-900 border-slate-300'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <span className="truncate">Configure LLM Key</span>
            </button>
          )}
        </div>

        {/* Deliverables */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            Deliverables
          </div>
          {reportNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-sm font-bold'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-500' : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  PDF
                </span>
              </button>
            );
          })}
        </div>

        {/* Load Other Scan Folder (Admin or Permitted) */}
        {(isAdmin || checkUserPermission(currentUser, 'load_custom_folder')) && (
          <div className="pt-1">
            <button
              onClick={onOpenDataLoader}
              className={`w-full h-9 flex items-center gap-2 px-3 rounded-xl text-xs font-mono font-medium transition-all border ${
                theme === 'dark'
                  ? 'bg-[#0B1224] hover:bg-[#121E38] text-slate-300 border-slate-800 hover:border-cyan-500/40'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <span className="truncate">Load Scan Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Area: User Pill, Theme Toggle & Export PDF */}
      <div className={`p-4 border-t space-y-2.5 ${
        theme === 'dark' ? 'bg-[#070B14] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        {/* User Identity Role Card */}
        {currentUser && (
          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
            theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                isAdmin 
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' 
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold font-mono uppercase tracking-wider truncate max-w-[130px] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  {currentUser.username || (isAdmin ? 'Admin' : 'User')}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {isAdmin ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`w-full h-9 flex items-center justify-between px-3 rounded-xl text-xs font-bold border transition-all ${
            theme === 'dark'
              ? 'bg-[#0D1527] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              : 'bg-white border-slate-300 text-slate-800 hover:text-slate-950 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            )}
            <span>{theme === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
          </div>

          <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
            Toggle
          </span>
        </button>

        {/* Export PDF Button */}
        <button
          onClick={() => {
            setActiveTab('report');
            if (onExportPdf) onExportPdf();
          }}
          className="w-full h-9 flex items-center justify-center gap-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all font-sans cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Export VAPT PDF</span>
        </button>
      </div>
    </aside>
  );
}

