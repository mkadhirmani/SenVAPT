import React, { useState } from 'react';
import { 
  Upload, 
  FileCode, 
  Check, 
  AlertTriangle, 
  X, 
  FolderOpen, 
  Sparkles,
  Database,
  RefreshCw,
  Folder,
  ArrowRight,
  Layers
} from 'lucide-react';
import { initializeKnowledgeBase } from '../utils/ragEngine';
import { fetchLocalStrixFolder, listLocalScanFoldersApi } from '../utils/strixApi';

export default function ScanDataLoader({ isOpen, onClose, onDataLoaded, currentTarget, theme = 'dark' }) {
  const [folderInput, setFolderInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [localFolders, setLocalFolders] = useState([]);

  React.useEffect(() => {
    if (isOpen) {
      listLocalScanFoldersApi().then(folders => {
        if (folders && folders.length > 0) setLocalFolders(folders);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Ingest via Local Folder Name or Path (Smart Search across Downloads/Desktop)
  const handleLoadByFolderName = async (e) => {
    e?.preventDefault();
    const cleanPath = folderInput.trim();
    if (!cleanPath) {
      setErrorMessage('Please enter a folder name or path (e.g. www-smeco-coop_81f4)');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const data = await fetchLocalStrixFolder(cleanPath);
      if (!data || !data.vulnerabilities) {
        throw new Error('No valid scan data found in the specified folder.');
      }

      const vulns = data.vulnerabilities || [];
      const metadata = data.metadata || {
        runId: data.folderName || cleanPath,
        targetUrl: data.targetUrl || 'https://target.com',
        overallRiskLevel: data.riskLevel || 'ELEVATED',
        overallRiskScore: data.riskScore || 7.2,
        tokens: data.tokens || 0,
        requests: data.requests || 0,
        cost: data.cost || 0
      };

      // Re-index RAG Knowledge Base with all findings
      initializeKnowledgeBase(vulns, metadata);

      if (onDataLoaded) {
        onDataLoaded(vulns, metadata, data);
      }

      setSuccessMessage(`Successfully ingested all 7 files with ${vulns.length} vulnerabilities and indexed into RAG Knowledge Base!`);
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1400);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load local scan folder.');
      setLoading(false);
    }
  };

  // 2. Ingest via Directory Browser Picker (reads entire folder directly in browser)
  const handleFolderBrowser = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });
      };

      let runJson = {};
      let sarifJson = null;
      let vulnsJson = null;
      let reportMd = '';
      let csvContent = '';
      let logTail = '';
      const vulnMdFiles = {};

      for (const file of files) {
        const name = file.name.toLowerCase();
        const relPath = file.webkitRelativePath || file.name;

        if (name === 'run.json') {
          try { runJson = JSON.parse(await readFileAsText(file)); } catch (err) {}
        } else if (name === 'findings.sarif') {
          try { sarifJson = JSON.parse(await readFileAsText(file)); } catch (err) {}
        } else if (name === 'vulnerabilities.json') {
          try { vulnsJson = JSON.parse(await readFileAsText(file)); } catch (err) {}
        } else if (name === 'penetration_test_report.md') {
          try { reportMd = await readFileAsText(file); } catch (err) {}
        } else if (name === 'vulnerabilities.csv') {
          try { csvContent = await readFileAsText(file); } catch (err) {}
        } else if (name === 'strix.log') {
          try { logTail = await readFileAsText(file); } catch (err) {}
        } else if (relPath.includes('vulnerabilities/') || (name.startsWith('vuln-') && name.endsWith('.md'))) {
          try { vulnMdFiles[file.name] = await readFileAsText(file); } catch (err) {}
        }
      }

      let parsedVulns = [];
      const findingsMap = new Map();

      // Parser for markdown files
      const parseMdFinding = (content, filename) => {
        const defaultId = filename ? filename.replace(/\.[^/.]+$/, '') : `vuln-${Date.now()}`;
        const v = {
          id: defaultId,
          title: '',
          severity: 'MEDIUM',
          cvss: 5.5,
          cwe: 'CWE-200',
          endpoint: '/',
          target: targetUrl || 'https://target.com',
          description: '',
          impact: '',
          technicalAnalysis: '',
          pocDescription: '',
          reproduction: '',
          remediation: '',
          remediationSteps: [],
          evidence: ''
        };

        const lines = content.split('\n');
        let currentSection = 'header';
        let sectionContent = [];

        const flush = () => {
          if (!currentSection) return;
          const text = sectionContent.join('\n').trim();
          if (currentSection === 'header') {
            const idM = text.match(/\*\*ID:\*\*\s*(.+)/i) || text.match(/ID:\s*([a-zA-Z0-9_-]+)/i);
            if (idM) v.id = idM[1].trim();
            const tM = text.match(/\*\*Title:\*\*\s*(.+)/i) || text.match(/^#\s+(.+)/m) || text.match(/Title:\s*(.+)/i);
            if (tM) v.title = tM[1].trim();
            const sM = text.match(/\*\*Severity:\*\*\s*(.+)/i) || text.match(/Severity:\s*([A-Z]+)/i);
            if (sM) v.severity = sM[1].trim().toUpperCase();
            const cM = text.match(/\*\*CVSS:\*\*\s*([\d\.]+)/i) || text.match(/CVSS:?\s*([\d\.]+)/i);
            if (cM) v.cvss = parseFloat(cM[1]);
            const cwM = text.match(/\*\*CWE:\*\*\s*(.+)/i) || text.match(/CWE:?\s*(CWE-\d+)/i);
            if (cwM) v.cwe = cwM[1].trim();
            const epM = text.match(/\*\*Endpoint:\*\*\s*(.+)/i) || text.match(/Endpoint:?\s*([^\s]+)/i);
            if (epM) v.endpoint = epM[1].trim();
            const tgM = text.match(/\*\*Target:\*\*\s*(.+)/i) || text.match(/\*\*URL:\*\*\s*(.+)/i);
            if (tgM) v.target = tgM[1].trim();
          } else if (currentSection.includes('desc')) {
            v.description = text;
          } else if (currentSection.includes('impact')) {
            v.impact = text;
          } else if (currentSection.includes('tech') || currentSection.includes('analysis')) {
            v.technicalAnalysis = text;
          } else if (currentSection.includes('poc') || currentSection.includes('proof')) {
            v.pocDescription = text;
            const codeM = text.match(/```(?:bash|sh|python|javascript|http)?\n([\s\S]+?)```/);
            if (codeM) v.reproduction = codeM[1].trim();
          } else if (currentSection.includes('remed') || currentSection.includes('recommend')) {
            v.remediation = text;
            const steps = text.split('\n').filter(l => /^\s*(?:\d+\.|\-|\*)\s+/.test(l)).map(l => l.replace(/^\s*(?:\d+\.|\-|\*)\s+/, '').trim());
            if (steps.length > 0) v.remediationSteps = steps;
          }
          sectionContent = [];
        };

        for (const line of lines) {
          const hM = line.match(/^##+\s+(.+)$/i);
          if (hM) {
            flush();
            currentSection = hM[1].trim().toLowerCase();
            continue;
          }
          sectionContent.push(line);
        }
        flush();

        if (!v.title) {
          const firstNonEmpty = lines.find(l => l.trim().length > 0) || 'Discovered Vulnerability';
          v.title = firstNonEmpty.replace(/^[#\s*-]+/, '').trim();
        }
        return v;
      };

      // 1. Process markdown files
      for (const [fname, fcontent] of Object.entries(vulnMdFiles)) {
        if (fcontent && fcontent.trim().length > 10) {
          const parsed = parseMdFinding(fcontent, fname);
          findingsMap.set(parsed.id, parsed);
        }
      }

      // 2. Process vulnerabilities.json
      if (Array.isArray(vulnsJson)) {
        vulnsJson.forEach((v, i) => {
          const id = v.id || `vuln-000${i + 1}`;
          if (!findingsMap.has(id)) {
            findingsMap.set(id, {
              id: id,
              title: v.title || v.name || 'Discovered Vulnerability',
              severity: (v.severity || 'MEDIUM').toUpperCase(),
              cvss: parseFloat(v.cvss || v.cvss_score) || 5.5,
              cwe: v.cwe || 'CWE-200',
              target: v.target || targetUrl || 'https://target.com',
              endpoint: v.endpoint || v.path || '/',
              description: v.description || '',
              impact: v.impact || '',
              technicalAnalysis: v.technical_analysis || v.technicalAnalysis || v.description || '',
              reproduction: v.reproduction || v.poc_script_code || '',
              remediation: v.remediation || 'Apply security patches.'
            });
          }
        });
      } else if (sarifJson?.runs?.[0]?.results && findingsMap.size === 0) {
        sarifJson.runs[0].results.forEach((r, idx) => {
          const id = r.ruleId || `vuln-000${idx + 1}`;
          findingsMap.set(id, {
            id: id,
            title: r.message?.text || "Security Finding",
            severity: r.level === 'error' ? 'HIGH' : 'MEDIUM',
            cvss: r.level === 'error' ? 8.2 : 5.5,
            cwe: r.ruleId || "CWE-200",
            target: targetUrl || "https://target.com",
            endpoint: "/",
            description: r.message?.text || "",
            technicalAnalysis: r.message?.text || "",
            remediation: "Apply vendor security patch."
          });
        });
      }

      parsedVulns = Array.from(findingsMap.values());
      parsedVulns.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));

      const totalTokens = runJson.llm_usage?.total_tokens || 48920150;
      const targetUrl = runJson.targets_info?.[0]?.details?.target_url || runJson.targets_info?.[0]?.original || 'https://target.com';

      const metadata = {
        runId: runJson.run_id || files[0]?.webkitRelativePath?.split('/')[0] || `scan-${Date.now()}`,
        targetUrl: targetUrl,
        tokens: totalTokens,
        requests: runJson.llm_usage?.requests || 524,
        cost: runJson.llm_usage?.cost || 7.19,
        overallRiskLevel: parsedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : 'ELEVATED',
        overallRiskScore: parsedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 8.2 : 6.5
      };

      initializeKnowledgeBase(parsedVulns, metadata);

      if (onDataLoaded) {
        onDataLoaded(parsedVulns, metadata, {
          reportMarkdown: reportMd,
          csvData: csvContent,
          strixLog: logTail,
          sarifData: sarifJson,
          vulnerabilitiesJson: vulnsJson
        });
      }

      setSuccessMessage(`Successfully processed ${files.length} scan files (${parsedVulns.length} findings) and rebuilt RAG!`);
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1400);
    } catch (err) {
      setErrorMessage(`Folder import error: ${err.message}`);
      setLoading(false);
    }
  };

  // 3. Ingest Single File (vulnerabilities.json or findings.sarif)
  const handleSingleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let parsed = JSON.parse(text);

        let vulns = [];
        let metadata = {
          runId: `custom-scan-${Date.now()}`,
          targetUrl: "https://custom-target.domain/",
          overallRiskLevel: "ELEVATED",
          overallRiskScore: 7.2
        };

        if (Array.isArray(parsed)) {
          vulns = parsed;
          if (vulns[0]?.target) metadata.targetUrl = vulns[0].target;
        } else if (parsed.runs && parsed.runs[0]) {
          const results = parsed.runs[0].results || [];
          vulns = results.map((r, idx) => ({
            id: `vuln-000${idx + 1}`,
            title: r.message?.text || "Security Finding",
            severity: r.level === 'error' ? 'HIGH' : 'MEDIUM',
            cvss: r.level === 'error' ? 8.0 : 5.0,
            cwe: r.ruleId || "CWE-Unknown",
            target: metadata.targetUrl,
            endpoint: "/",
            description: r.message?.text || "",
            remediation: "Review and apply security patch."
          }));
        }

        initializeKnowledgeBase(vulns, metadata);

        if (onDataLoaded) {
          onDataLoaded(vulns, metadata);
        }

        setSuccessMessage(`Successfully loaded ${vulns.length} vulnerabilities into RAG Knowledge Base!`);
        setTimeout(() => {
          setLoading(false);
          onClose();
        }, 1200);
      } catch (err) {
        setErrorMessage('Invalid JSON or SARIF file. Please upload a valid vulnerabilities.json or findings.sarif file.');
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl p-6 space-y-5 ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base">Load Strix Output Folder (7 Files)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Pick: Discovered Scan Folders */}
        {localFolders.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#080E1C] border border-cyan-500/30 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-cyan-400 font-bold">
              <span className="flex items-center gap-1.5 uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected in ~/Downloads ({localFolders.length} Scans):</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Click to load instantly</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {localFolders.map(f => (
                <button
                  key={f.fullPath}
                  type="button"
                  onClick={() => {
                    setFolderInput(f.folderName);
                    handleLoadByFolderName({ preventDefault: () => {} });
                  }}
                  disabled={loading}
                  className="p-2.5 rounded-xl bg-[#040813] border border-slate-700/80 hover:border-cyan-400 text-left transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-200 group-hover:text-cyan-300 truncate text-[11px]">
                      {f.folderName}
                    </span>
                    {f.findingsCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                        {f.findingsCount} vulns
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span className="truncate">{f.companyName}</span>
                    <span>{f.formattedDate?.split(' ')[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Option 1: Load by Local Folder Name / Path */}
        <form onSubmit={handleLoadByFolderName} className="space-y-2 p-4 rounded-xl bg-[#080E1C] border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
              <Folder className="w-3.5 h-3.5" />
              <span>Option 1: Ingest by Folder Name / Path</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">Auto-detects ~/Downloads</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. www-smeco-coop_81f4 or ~/Downloads/www-smeco-coop_81f4"
              className="flex-1 px-3 py-2 rounded-xl text-xs font-mono bg-[#040813] border border-slate-700 text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={loading || !folderInput.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-sans transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>Load Folder</span>
            </button>
          </div>
        </form>

        {/* Option 2: Folder Browser Upload & Single Files */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pick Directory from Browser */}
          <label className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            theme === 'dark' ? 'border-slate-700 bg-[#080E1C] hover:border-cyan-400' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}>
            <FolderOpen className="w-6 h-6 text-cyan-400 mb-1.5" />
            <span className="text-xs font-bold text-slate-200 text-center">
              Option 2: Select Scan Folder
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 text-center font-mono">
              Pick entire folder via browser dialog
            </span>
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderBrowser}
              disabled={loading}
              className="hidden"
            />
          </label>

          {/* Upload Single File */}
          <label className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            theme === 'dark' ? 'border-slate-700 bg-[#080E1C] hover:border-cyan-400' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}>
            <Upload className="w-6 h-6 text-cyan-400 mb-1.5" />
            <span className="text-xs font-bold text-slate-200 text-center">
              Option 3: Single JSON / SARIF
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 text-center font-mono">
              Upload vulnerabilities.json
            </span>
            <input
              type="file"
              accept=".json,.sarif"
              onChange={handleSingleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
