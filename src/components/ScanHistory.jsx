import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Globe, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Download, 
  Trash2, 
  CheckCircle2, 
  ArrowRight, 
  Radar, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  AlertTriangle, 
  RefreshCw, 
  Server 
} from 'lucide-react';
import { exportReportToPdf } from '../utils/pdfExport';
import { fetchAllRemoteScans } from '../utils/strixApi';

export default function ScanHistory({ 
  scanHistory = [], 
  activeScanId, 
  onSelectScan, 
  onDeleteScan, 
  onTriggerNewScan,
  onSyncAllServerScans,
  theme = 'light' 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const handleSyncServerScans = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const runs = await fetchAllRemoteScans();
      if (runs && runs.length > 0) {
        if (onSyncAllServerScans) {
          onSyncAllServerScans(runs);
        }
        setSyncMessage(`Synced ${runs.length} scan runs from server!`);
      } else {
        setSyncMessage('No remote runs found on server.');
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      setSyncMessage(`Error: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredHistory = scanHistory.filter(scan => {
    const matchesSearch = 
      scan.targetUrl?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk = filterRisk === 'ALL' || scan.riskLevel === filterRisk;

    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Panel */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-colors ${
        theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#006FE3] dark:text-[#4D9AEC] font-heading text-xs font-bold uppercase tracking-wider">
              <History className="w-4 h-4 text-[#006FE3]" />
              <span>Scan History Archive</span>
            </div>
            <h2 className={`text-2xl font-heading font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              Security Audit History ({scanHistory.length})
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              All past and active penetration test scans. Select any scan to load its findings, AI analysis, and downloadable PDF report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scans..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-sans focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#001127] border border-[#0A3778] text-slate-200 placeholder-slate-500 focus:border-[#006FE3]'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500 focus:border-[#006FE3]'
                }`}
              />
            </div>

            <button
              onClick={onTriggerNewScan}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-heading font-bold text-xs shadow-md shadow-[#006FE3]/30 transition-all flex-shrink-0 cursor-pointer"
            >
              <Radar className="w-3.5 h-3.5" />
              <span>Start New Scan</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="p-2.5 rounded-xl bg-[#006FE3]/15 border border-[#006FE3]/40 text-[#006FE3] dark:text-[#4D9AEC] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Filter Pills */}
        <div className={`flex items-center gap-2 pt-3 border-t text-xs ${
          theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-200'
        }`}>
          <span className={`text-[11px] font-heading font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            Filter Risk:
          </span>
          {['ALL', 'HIGH', 'ELEVATED', 'MEDIUM'].map(risk => (
            <button
              key={risk}
              onClick={() => setFilterRisk(risk)}
              className={`px-3 py-1 rounded-lg font-heading text-[11px] font-bold transition-all cursor-pointer ${
                filterRisk === risk
                  ? 'bg-[#006FE3] text-white shadow-sm shadow-[#006FE3]/30 font-bold'
                  : theme === 'dark'
                  ? 'bg-[#001127] text-slate-300 hover:text-white border border-[#0A3778]'
                  : 'bg-slate-100 text-slate-700 hover:text-[#001B41] border border-slate-200'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>

      {/* History Grid / List */}
      <div className="space-y-3">
        {filteredHistory.map((scan) => {
          const isActive = scan.id === activeScanId;
          const isHigh = scan.riskLevel === 'HIGH' || scan.riskLevel === 'ELEVATED';

          return (
            <div
              key={scan.id}
              onClick={() => onSelectScan(scan)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isActive
                  ? 'ring-2 ring-[#006FE3] ' + (theme === 'dark' ? 'bg-[#002863] border-[#006FE3] shadow-md' : 'bg-[#E6F1FC] border-[#006FE3] shadow-md')
                  : theme === 'dark'
                  ? 'bg-[#001E4B] border-[#0A3778] hover:border-[#006FE3] hover:bg-[#002254]'
                  : 'bg-white border-slate-200 hover:border-[#006FE3] hover:shadow-md'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Scan Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-heading font-bold px-2.5 py-0.5 rounded bg-[#001127] border border-[#0A3778] text-[#4D9AEC]">
                      {scan.companyName || 'Target Organization'}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-heading px-2 py-0.5 rounded-full bg-[#299346]/20 text-[#299346] border border-[#299346]/40 font-bold">
                        ACTIVE IN DASHBOARD
                      </span>
                    )}
                    <span className={`text-xs font-mono flex items-center gap-1 font-medium ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                      <Globe className="w-3 h-3 text-[#006FE3]" />
                      {scan.targetUrl}
                    </span>
                  </div>

                  <p className={`text-xs font-mono line-clamp-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
                    {scan.profile || 'Autonomous AI Penetration Testing (OWASP WSTG v4.2)'}
                  </p>

                  <div className={`flex flex-wrap items-center gap-4 text-xs font-mono pt-1 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'
                  }`}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {scan.timestamp}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {scan.duration || '38 min'}
                    </span>
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}>
                      Folder: <code className="text-[#006FE3] dark:text-[#4D9AEC] font-bold">{scan.folderName || scan.outputFolderPath?.split('/').filter(Boolean).pop() || scan.id}</code>
                    </span>
                    {scan.scannedByName && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-bold bg-[#3C2C86]/20 text-[#3C2C86] dark:text-[#80B7F1] border border-[#3C2C86]/30">
                        Audited by: {scan.scannedByName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Risk Badge */}
                  <div className={`px-3.5 py-2 rounded-xl border text-center font-heading ${
                    isHigh
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : 'bg-[#B9623C]/10 border-[#B9623C]/30 text-[#B9623C]'
                  }`}>
                    <div className="text-[10px] uppercase font-bold">Risk Posture</div>
                    <div className="text-sm font-black">{scan.riskLevel} ({scan.riskScore || 8.2})</div>
                  </div>

                  {/* Findings Count */}
                  <div className={`px-3.5 py-2 rounded-xl border text-center font-heading ${
                    theme === 'dark' ? 'bg-[#001127] border-[#0A3778] text-slate-200' : 'bg-slate-50 border-slate-200 text-[#001B41]'
                  }`}>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Findings</div>
                    <div className="text-sm font-black text-rose-500">
                      {scan.findingsCount || (scan.vulnerabilities ? scan.vulnerabilities.length : 0)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectScan(scan);
                      }}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-heading font-bold transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-[#006FE3] text-white border-[#006FE3] shadow-md shadow-[#006FE3]/30'
                          : theme === 'dark'
                          ? 'bg-[#006FE3]/15 hover:bg-[#006FE3]/25 text-[#4D9AEC] border-[#006FE3]/40'
                          : 'bg-[#E6F1FC] hover:bg-[#B3D4F7] text-[#006FE3] border-[#B3D4F7]'
                      }`}
                    >
                      <span>{isActive ? 'Active' : 'Load Scan'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {scanHistory.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteScan(scan.id);
                        }}
                        title="Delete scan from history"
                        className="p-2 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 border border-slate-700/60 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredHistory.length === 0 && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${
            theme === 'dark' ? 'bg-[#001E4B] border-[#0A3778]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#006FE3]/15 text-[#006FE3] mx-auto flex items-center justify-center border border-[#006FE3]/30">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-heading font-bold text-slate-900 dark:text-white">No Scan Records Available</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No past scans found for your user account. Launch an autonomous security assessment to populate this archive.
              </p>
            </div>
            {onTriggerNewScan && (
              <button
                onClick={onTriggerNewScan}
                className="px-5 py-2 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-heading font-bold text-xs shadow-md shadow-[#006FE3]/30 transition-all cursor-pointer"
              >
                Launch New Scan &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
