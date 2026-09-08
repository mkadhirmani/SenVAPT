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
  vulnerabilitiesCount = 0,
  scanHistoryCount = 0,
  companyName = "",
  targetUrl = "",
  riskLevel = ""
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
      theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Top Brand Area */}
      <div className={`p-5 border-b space-y-3 ${
        theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-200'
      }`}>
        <div className="cursor-pointer flex flex-col items-start" onClick={() => setActiveTab('overview')}>
          <Logo theme={theme} size="md" />
          <span className="text-[10px] font-heading font-medium tracking-wider text-[#006FE3] dark:text-[#4D9AEC] mt-1">
            Enterprise Security. Without Compromise.
          </span>
        </div>

        {/* Dynamic Company & Target Status Pill (Only when target exists) */}
        {(companyName || targetUrl) && (
          <div className={`p-2.5 rounded-xl border flex flex-col gap-1 text-[11px] font-mono transition-all ${
            theme === 'dark' ? 'bg-[#001127]/80 border-[#0A3778]' : 'bg-[#E6F1FC] border-[#B3D4F7]'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-bold truncate text-xs font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                {companyName || 'Active Target'}
              </span>
              {riskLevel && riskLevel !== 'NONE' && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                  riskLevel === 'CRITICAL' 
                    ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                    : riskLevel === 'HIGH'
                    ? 'bg-[#B9623C]/20 text-[#B9623C] border-[#B9623C]/30'
                    : 'bg-[#299346]/20 text-[#299346] border-[#299346]/30'
                }`}>
                  {riskLevel}
                </span>
              )}
            </div>
            {targetUrl && (
              <div className="flex items-center gap-1.5 text-slate-400 truncate text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#299346] animate-pulse flex-shrink-0"></span>
                <span className="truncate">{targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Admin Navigation Section (Admin Only) */}
        {isAdmin && (
          <div className="space-y-1">
            <div className={`px-3 text-[10px] font-heading font-bold uppercase tracking-wider mb-1.5 text-[#4D9AEC] flex items-center justify-between`}>
              <span>Administration</span>
              <span className="text-[8px] px-1 py-0.2 rounded bg-[#006FE3]/20 text-[#4D9AEC] border border-[#006FE3]/30">ROOT</span>
            </div>
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30 font-bold'
                  : theme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-[#002863]'
                  : 'text-slate-700 hover:text-[#001B41] hover:bg-[#E6F1FC]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'admin' ? 'text-white' : 'text-[#006FE3]'}`} />
                <span className="truncate font-heading font-bold">Admin Portal</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                activeTab === 'admin' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-[#006FE3]/20 text-[#006FE3] dark:text-[#80B7F1] border border-[#006FE3]/30'
              }`}>
                USERS
              </span>
            </button>
          </div>
        )}

        {/* Operations */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-heading font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-[#808D9F]' : 'text-slate-500'
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
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30 font-bold'
                    : theme === 'dark'
                    ? 'text-slate-300 hover:text-white hover:bg-[#002863]'
                    : 'text-slate-700 hover:text-[#001B41] hover:bg-[#E6F1FC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : theme === 'dark' ? 'text-[#80B7F1]' : 'text-[#006FE3]'}`} />
                  <span className="truncate font-medium">{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0 ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : item.id === 'history' 
                      ? 'bg-[#006FE3]/20 text-[#006FE3] dark:text-[#80B7F1] border border-[#006FE3]/30'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                  }`}>
                    {item.count}
                  </span>
                )}

                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold animate-pulse flex-shrink-0 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-[#006FE3]/20 text-[#006FE3] dark:text-[#80B7F1]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* AI Assistant */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-heading font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-[#808D9F]' : 'text-slate-500'
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
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30 font-bold'
                    : theme === 'dark'
                    ? 'text-slate-300 hover:text-white hover:bg-[#002863]'
                    : 'text-slate-700 hover:text-[#001B41] hover:bg-[#E6F1FC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : theme === 'dark' ? 'text-[#80B7F1]' : 'text-[#006FE3]'}`} />
                  <span className="truncate font-medium">{item.label}</span>
                </div>

                <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-[#3C2C86]/20 text-[#3C2C86] dark:text-[#80B7F1] border border-[#3C2C86]/30'
                }`}>
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
              className={`w-full h-9 flex items-center gap-3 px-3 rounded-xl text-xs font-mono font-medium transition-all border cursor-pointer ${
                strixConfig.host
                  ? 'bg-[#299346]/10 border-[#299346]/30 text-[#299346] dark:text-emerald-400 hover:bg-[#299346]/20'
                  : theme === 'dark'
                  ? 'bg-[#001127]/60 hover:bg-[#002863] text-slate-300 border-[#0A3778] hover:border-[#006FE3]'
                  : 'bg-slate-50 hover:bg-[#E6F1FC] text-[#001B41] border-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
              <span className="truncate">
                {strixConfig.host ? `SSH: ${strixConfig.host}` : 'Remote SSH Server'}
              </span>
            </button>
          )}

          {/* AI Settings / Key configuration (Admin or Permitted) */}
          {(isAdmin || checkUserPermission(currentUser, 'manage_settings')) && (
            <button
              onClick={onOpenLlmSettings}
              className={`w-full h-9 flex items-center gap-3 px-3 rounded-xl text-xs font-mono font-medium transition-all border cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#001127]/60 hover:bg-[#002863] text-slate-300 border-[#0A3778] hover:border-[#006FE3]'
                  : 'bg-slate-50 hover:bg-[#E6F1FC] text-[#001B41] border-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
              <span className="truncate">Configure LLM Key</span>
            </button>
          )}
        </div>

        {/* Deliverables */}
        <div className="space-y-1">
          <div className={`px-3 text-[10px] font-heading font-bold uppercase tracking-wider mb-1.5 ${
            theme === 'dark' ? 'text-[#808D9F]' : 'text-slate-500'
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
                className={`w-full h-10 flex items-center justify-between px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#006FE3] text-white shadow-md shadow-[#006FE3]/30 font-bold'
                    : theme === 'dark'
                    ? 'text-slate-300 hover:text-white hover:bg-[#002863]'
                    : 'text-slate-700 hover:text-[#001B41] hover:bg-[#E6F1FC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : theme === 'dark' ? 'text-[#80B7F1]' : 'text-[#006FE3]'}`} />
                  <span className="truncate font-medium">{item.label}</span>
                </div>

                <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${
                  isActive ? 'text-white' : theme === 'dark' ? 'text-[#808D9F]' : 'text-slate-500'
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
              className={`w-full h-9 flex items-center gap-2 px-3 rounded-xl text-xs font-mono font-medium transition-all border cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#001127]/60 hover:bg-[#002863] text-slate-300 border-[#0A3778] hover:border-[#006FE3]'
                  : 'bg-slate-50 hover:bg-[#E6F1FC] text-[#001B41] border-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#006FE3] flex-shrink-0" />
              <span className="truncate">Load Scan Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Area: User Pill, Theme Toggle & Export PDF */}
      <div className={`p-4 border-t space-y-2.5 ${
        theme === 'dark' ? 'bg-[#001127] border-[#0A3778]' : 'bg-[#F8FAFC] border-slate-200'
      }`}>
        {/* User Identity Role Card */}
        {currentUser && (
          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
            theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                isAdmin 
                  ? 'bg-[#006FE3]/15 text-[#4D9AEC] border border-[#006FE3]/30' 
                  : currentUser?.role === 'sales'
                  ? 'bg-[#B9623C]/15 text-[#B9623C] border border-[#B9623C]/30'
                  : 'bg-[#299346]/15 text-[#299346] border border-[#299346]/30'
              }`}>
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold font-heading uppercase tracking-wider truncate max-w-[130px] ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                  {currentUser.username || (isAdmin ? 'Admin' : 'User')}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${currentUser?.role === 'sales' ? 'bg-[#B9623C]' : 'bg-[#299346]'}`}></span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {isAdmin ? 'Administrator' : currentUser?.role === 'sales' ? 'Sales Team' : 'Standard User'}
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
          className={`w-full h-9 flex items-center justify-between px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-[#001E4B] border-[#0A3778] text-slate-200 hover:text-white hover:border-[#006FE3]'
              : 'bg-white border-slate-200 text-[#001B41] hover:bg-[#E6F1FC] shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-[#80B7F1] flex-shrink-0" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[#B9623C] flex-shrink-0" />
            )}
            <span className="font-heading font-semibold">{theme === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
          </div>

          <span className="text-[10px] font-mono text-[#006FE3] dark:text-[#4D9AEC] font-bold">
            Toggle
          </span>
        </button>

        {/* Export PDF Button */}
        <button
          onClick={() => {
            setActiveTab('report');
            if (onExportPdf) onExportPdf();
          }}
          className="w-full h-9 flex items-center justify-center gap-2 px-3 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-bold text-xs shadow-md shadow-[#006FE3]/30 transition-all font-heading cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Export VAPT PDF</span>
        </button>
      </div>
    </aside>
  );
}
