import React from 'react';
import Logo from './Logo';
import { 
  LayoutDashboard, 
  Radar, 
  ShieldAlert, 
  GitBranch, 
  Bot, 
  FileText, 
  Download, 
  Globe, 
  Activity,
  Sparkles
} from 'lucide-react';
import { SCAN_METADATA } from '../data/scanData';

export default function Navbar({ activeTab, setActiveTab, onTriggerScan, isScanning, onExportPdf }) {
  const navItems = [
    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'scan', label: 'AI Scan Engine', icon: Radar, badge: isScanning ? 'LIVE' : null },
    { id: 'vulnerabilities', label: 'Vulnerabilities', icon: ShieldAlert, count: 7 },
    { id: 'attack-chain', label: 'Attack Chain Graph', icon: GitBranch },
    { id: 'rag-hub', label: 'RAG AI Hub', icon: Bot, isNew: true },
    { id: 'report', label: 'VAPT PDF Report', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-xl">
      {/* Top Banner / Telemetry Bar */}
      <div className="hidden md:flex items-center justify-between px-6 py-1.5 bg-gradient-to-r from-[#0B1528] via-[#0D1B33] to-[#0B1528] border-b border-cyan-900/40 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <strong className="text-slate-200">TARGET:</strong> {SCAN_METADATA.targetUrl}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">
            <strong>SCAN ID:</strong> {SCAN_METADATA.runId}
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            OWASP WSTG v4.2 COMPLIANT
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-800/60 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">
            <Activity className="w-3 h-3 text-rose-400 animate-pulse" />
            RISK POSTURE: {SCAN_METADATA.overallRiskLevel} ({SCAN_METADATA.overallRiskScore}/10)
          </div>
          <span className="text-slate-400">
            AI TOKENS: <strong className="text-cyan-300">42.6M</strong>
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <Logo size="md" />
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/90 to-blue-950/80 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>

                  {item.count !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded text-[10px] font-mono font-bold">
                      {item.count}
                    </span>
                  )}

                  {item.isNew && (
                    <span className="flex items-center gap-0.5 ml-1 px-1.5 py-0.2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded text-[9px] font-mono font-bold">
                      <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                      RAG
                    </span>
                  )}

                  {item.badge && (
                    <span className="ml-1 px-1.5 py-0.2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded text-[10px] font-mono font-bold animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTriggerScan}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                isScanning
                  ? 'bg-cyan-500 text-black border-cyan-300 shadow-glow-cyan animate-pulse'
                  : 'bg-[#0F1C36] hover:bg-[#16274D] text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
              }`}
            >
              <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin' : 'text-cyan-400'}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Target'}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('report');
                if (onExportPdf) onExportPdf();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-glow-cyan transition-all transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span className="hidden sm:inline font-semibold">Download VAPT PDF</span>
              <span className="sm:hidden font-semibold">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Scroll */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto border-t border-slate-800 bg-[#0A101D]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                isActive
                  ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
