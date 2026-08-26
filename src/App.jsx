import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ScanHud from './components/ScanHud';
import ScanHistory from './components/ScanHistory';
import DashboardOverview from './components/DashboardOverview';
import VulnerabilityList from './components/VulnerabilityList';
import VulnerabilityModal from './components/VulnerabilityModal';
import AttackChainView from './components/AttackChainView';
import Chatbot from './components/Chatbot';
import PdfReport from './components/PdfReport';
import ScanDataLoader from './components/ScanDataLoader';
import LlmSettingsModal from './components/LlmSettingsModal';
import StrixConnectionModal from './components/StrixConnectionModal';
import LoginScreen from './components/LoginScreen';
import AdminUserManagement from './components/AdminUserManagement';
import { SCAN_METADATA, VULNERABILITIES } from './data/scanData';
import { 
  getStoredScanHistory, 
  saveScanHistory, 
  syncScanHistoryWithServer,
  INITIAL_SCAN_HISTORY, 
  EMCOCHEM_VULNERABILITIES, 
  SMECO_VULNERABILITIES,
  EMCOCHEM_ATTACK_CHAIN,
  SMECO_ATTACK_CHAIN 
} from './data/scanHistoryData';
import { 
  getCurrentUser, 
  setCurrentUser, 
  logoutUser, 
  checkUserPermission 
} from './utils/auth';
import { initializeKnowledgeBase } from './utils/ragEngine';
import { fetchAllRemoteScans, fetchStrixServerConfig } from './utils/strixApi';
import { fetchGlobalLlmConfig } from './utils/llmEngine';
import { Bot, MessageSquare, X, Sparkles, CheckCircle2, ShieldAlert, Bell } from 'lucide-react';

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (_) {}
}

function sendDesktopNotification(title, body) {
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/logo/Logo dark.jpg'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, {
              body: body,
              icon: '/logo/Logo dark.jpg'
            });
          }
        });
      }
    }
  } catch (_) {}
}

export default function App() {
  // Authentication State
  const [currentUser, setAuthUser] = useState(() => getCurrentUser());

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sennovate_theme') || 'dark';
  });

  // Scan History state
  const [scanHistory, setScanHistory] = useState(() => getStoredScanHistory());

  // Scoped Scan History based on User Role:
  // Admin sees ALL scans.
  // Standard User sees ONLY scans created by that user.
  const visibleScanHistory = React.useMemo(() => {
    if (!currentUser) return scanHistory;
    if (currentUser.role === 'admin') {
      return scanHistory;
    }
    return scanHistory.filter(s => {
      const creator = (s.createdBy || s.scannedBy || '').toLowerCase();
      return creator === currentUser.username.toLowerCase();
    });
  }, [scanHistory, currentUser]);
  
  // Default to the last active scan ID or the most recent scan in visible history
  const [activeScanId, setActiveScanId] = useState(() => {
    const user = getCurrentUser();
    const history = getStoredScanHistory();
    const visible = (!user || user.role === 'admin')
      ? history
      : history.filter(s => (s.createdBy || s.scannedBy || '').toLowerCase() === user.username.toLowerCase());

    const savedActiveId = localStorage.getItem('sennovate_last_active_scan_id');
    if (savedActiveId && visible.some(s => s.id === savedActiveId)) {
      return savedActiveId;
    }
    return visible[0]?.id || "";
  });

  // Dynamic Scan Findings state - reactively bound to activeScanId and visibleScanHistory
  const activeScan = React.useMemo(() => {
    if (visibleScanHistory.length === 0) return null;
    const match = visibleScanHistory.find(s => s.id === activeScanId);
    if (match) return match;
    return visibleScanHistory[0] || null;
  }, [visibleScanHistory, activeScanId]);

  // Persistent Scanner HUD State across all tabs
  const [scannerState, setScannerState] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sennovate_persistent_scanner_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.targetUrl) return parsed;
      }
    } catch (e) {}

    const history = getStoredScanHistory();
    const latest = history[0] || INITIAL_SCAN_HISTORY[0];
    const folder = latest?.outputFolderPath || latest?.metadata?.remoteRunDir || '';

    return {
      targetUrl: latest?.targetUrl || 'https://www.smeco.coop/',
      companyName: latest?.companyName || 'Smeco Inc',
      logs: [
        `[INIT] Remote SSH Server Connected: root@127.0.0.1`,
        `[TARGET] ${latest?.targetUrl || 'https://www.smeco.coop/'} (${latest?.companyName || 'Smeco Inc'})`,
        `[ENGINE] Autonomous AI Penetration Testing Engine (OWASP WSTG v4.2)`,
        `[RECON] Discovered active endpoints and API gateways`,
        `[STATUS] Findings recorded to server database.`,
        `[OUTPUT FOLDER PATH] ${folder}`,
        `[COMPLETED] Autonomous Security Audit completed successfully.`
      ],
      discoveredFindings: latest?.vulnerabilities || [],
      scanStats: {
        requests: latest?.requests || 524,
        tokens: latest?.tokens || 48920150,
        durationSec: latest?.durationSec || 2280,
        currentAgent: 'Autonomous VAPT Agent'
      },
      scanFinished: true,
      activeScanId: latest?.id || "www-smeco-coop_81f4",
      outputFolderPath: folder,
      scanError: null
    };
  });

  // Save scanner state to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem('sennovate_persistent_scanner_state', JSON.stringify(scannerState));
    } catch (e) {}
  }, [scannerState]);

  // Active view tab state: Default to 'admin' portal for Admin users, 'overview' for Standard users
  const [activeTab, setActiveTab] = useState(() => {
    const user = getCurrentUser();
    if (user?.role === 'admin') {
      return 'admin';
    }
    return 'overview';
  });
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDataLoaderOpen, setIsDataLoaderOpen] = useState(false);
  const [isLlmSettingsOpen, setIsLlmSettingsOpen] = useState(false);
  const [isStrixSettingsOpen, setIsStrixSettingsOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);

  // Sync scan history automatically on cross-tab/session updates
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'sennovate_scan_history') {
        const fresh = getStoredScanHistory();
        setScanHistory(fresh);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Apply theme to HTML root
  useEffect(() => {
    localStorage.setItem('sennovate_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  // Toggle Theme helper
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auto-sync server config, LLM config, and scans on initial load
  useEffect(() => {
    async function syncOnMount() {
      try {
        await Promise.all([
          fetchStrixServerConfig(),
          fetchGlobalLlmConfig()
        ]);
        const serverScans = await syncScanHistoryWithServer();
        if (serverScans && serverScans.length > 0) {
          setScanHistory(serverScans);
        }
        const remoteRuns = await fetchAllRemoteScans();
        if (remoteRuns && remoteRuns.length > 0) {
          handleSyncAllServerScans(remoteRuns);
        }
      } catch (err) {
        console.warn('Auto-sync scans from server note:', err.message);
      }
    }
    syncOnMount();
  }, []);

  // Initialize RAG knowledge base on active scan load
  useEffect(() => {
    if (activeScan && activeScan.vulnerabilities) {
      initializeKnowledgeBase(activeScan.vulnerabilities, activeScan.metadata || {});
    }
  }, [activeScan]);

  // Handle switching active scan target
  const handleSelectScan = (scan, keepTab = false) => {
    const resolvedVulns = resolveScanFindings(scan);
    const enrichedScan = {
      ...scan,
      vulnerabilities: resolvedVulns,
      findingsCount: resolvedVulns.length,
      highCount: resolvedVulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length,
      medCount: resolvedVulns.filter(v => v.severity === 'MEDIUM').length,
      riskLevel: resolvedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : (resolvedVulns.length > 0 ? 'ELEVATED' : 'LOW'),
      riskScore: resolvedVulns.length > 0 ? (resolvedVulns[0]?.cvss || 5.5) : 4.0,
      metadata: {
        ...(scan.metadata || {}),
        totalFindings: resolvedVulns.length,
        highCount: resolvedVulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length,
        medCount: resolvedVulns.filter(v => v.severity === 'MEDIUM').length,
        overallRiskScore: resolvedVulns.length > 0 ? (resolvedVulns[0]?.cvss || 5.5) : 4.0,
        overallRiskLevel: resolvedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : (resolvedVulns.length > 0 ? 'ELEVATED' : 'LOW')
      }
    };

    setActiveScanId(enrichedScan.id);
    localStorage.setItem('sennovate_last_active_scan_id', enrichedScan.id);
    initializeKnowledgeBase(resolvedVulns, enrichedScan.metadata || {});
    
    // Update scanner default values to match the selected scan
    const folder = enrichedScan.outputFolderPath || enrichedScan.metadata?.remoteRunDir || '';

    // If a scan is actively running, DO NOT overwrite the ongoing terminal scan state!
    if (isScanning || (scannerState && !scannerState.scanFinished)) {
      if (!keepTab) {
        setActiveTab('overview');
      }
      return;
    }

    setScannerState(prev => {
      if (isScanning || (prev && !prev.scanFinished)) {
        return prev;
      }
      const preservedLogs = (scan.logs && scan.logs.length > 0) ? scan.logs : [
        `[INIT] Remote SSH Server Connected: root@127.0.0.1`,
        `[TARGET] ${scan.targetUrl} (${scan.companyName})`,
        `[ENGINE] Autonomous AI Penetration Testing Engine (OWASP WSTG v4.2)`,
        `[TELEMETRY] Tokens: ${scan.tokens || scan.metadata?.tokens || 0} | HTTP Checks: ${scan.requests || scan.metadata?.requests || 0} | Cost: $${typeof scan.cost === 'number' ? scan.cost.toFixed(2) : (typeof scan.metadata?.cost === 'number' ? scan.metadata.cost.toFixed(2) : '0.00')}`,
        `[STATUS] Findings loaded for ${scan.companyName} (${enrichedScan.findingsCount} verified findings).`,
        `[OUTPUT FOLDER PATH] ${folder}`,
        `[COMPLETED] Autonomous Security Audit completed successfully.`
      ];

      return {
        targetUrl: scan.targetUrl,
        companyName: scan.companyName,
        logs: preservedLogs,
        discoveredFindings: resolvedVulns,
        scanStats: {
          requests: typeof scan.requests === 'number' ? scan.requests : (typeof scan.metadata?.requests === 'number' ? scan.metadata.requests : 0),
          tokens: typeof scan.tokens === 'number' ? scan.tokens : (typeof scan.metadata?.tokens === 'number' ? scan.metadata.tokens : 0),
          totalTokens: typeof scan.tokens === 'number' ? scan.tokens : (typeof scan.metadata?.tokens === 'number' ? scan.metadata.tokens : 0),
          outputTokens: scan.outputTokens || scan.metadata?.outputTokens || 0,
          inputTokens: scan.inputTokens || scan.metadata?.inputTokens || 0,
          cost: typeof scan.cost === 'number' ? scan.cost : (typeof scan.metadata?.cost === 'number' ? scan.metadata.cost : 0),
          durationSec: scan.durationSec || scan.metadata?.durationSec || 240,
          currentAgent: 'Autonomous VAPT Agent'
        },
        scanFinished: true,
        activeScanId: scan.id,
        outputFolderPath: folder,
        scanError: null
      };
    });

    if (!keepTab) {
      setActiveTab('overview');
    }
  };

  // Handle deleting a scan from history
  const handleDeleteScan = (scanId) => {
    const updated = scanHistory.filter(s => s.id !== scanId);
    setScanHistory(updated);
    saveScanHistory(updated);

    if (activeScanId === scanId && updated.length > 0) {
      handleSelectScan(updated[0], true);
    }
  };

  // Handle saving newly finished scan
  const handleSaveNewScan = (newScanData, shouldNavigate = false) => {
    const resolvedVulns = resolveScanFindings(newScanData);
    const creatorUser = newScanData.createdBy || currentUser?.username || 'user';
    const creatorName = newScanData.scannedByName || currentUser?.name || (currentUser?.role === 'admin' ? 'Administrator' : 'User');
    const enrichedScan = {
      ...newScanData,
      createdBy: creatorUser,
      scannedBy: creatorUser,
      scannedByName: creatorName,
      userRole: newScanData.userRole || (currentUser?.role === 'admin' ? 'Administrator' : 'User'),
      vulnerabilities: resolvedVulns,
      findingsCount: resolvedVulns.length,
      highCount: resolvedVulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length,
      medCount: resolvedVulns.filter(v => v.severity === 'MEDIUM').length,
      riskLevel: resolvedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : (resolvedVulns.length > 0 ? 'ELEVATED' : 'LOW'),
      riskScore: resolvedVulns.length > 0 ? (resolvedVulns[0]?.cvss || 5.5) : 4.0,
      metadata: {
        ...(newScanData.metadata || {}),
        createdBy: creatorUser,
        scannedBy: creatorUser,
        scannedByName: creatorName,
        userRole: newScanData.userRole || (currentUser?.role === 'admin' ? 'Administrator' : 'User'),
        totalFindings: resolvedVulns.length,
        highCount: resolvedVulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length,
        medCount: resolvedVulns.filter(v => v.severity === 'MEDIUM').length,
        overallRiskScore: resolvedVulns.length > 0 ? (resolvedVulns[0]?.cvss || 5.5) : 4.0,
        overallRiskLevel: resolvedVulns.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : (resolvedVulns.length > 0 ? 'ELEVATED' : 'LOW')
      }
    };

    const updated = [enrichedScan, ...scanHistory.filter(s => s.id !== enrichedScan.id)];
    setScanHistory(updated);
    saveScanHistory(updated);
    setActiveScanId(enrichedScan.id);
    localStorage.setItem('sennovate_last_active_scan_id', enrichedScan.id);
    initializeKnowledgeBase(resolvedVulns, enrichedScan.metadata);

    // Update scanner default values to match the newly completed scan
    setScannerState(prev => ({
      ...prev,
      targetUrl: enrichedScan.targetUrl || prev.targetUrl,
      companyName: enrichedScan.companyName || prev.companyName,
      logs: enrichedScan.logs || prev.logs,
      discoveredFindings: resolvedVulns,
      scanStats: {
        requests: enrichedScan.requests || prev.scanStats?.requests || 0,
        tokens: enrichedScan.tokens || prev.scanStats?.tokens || 0,
        totalTokens: enrichedScan.tokens || prev.scanStats?.totalTokens || 0,
        outputTokens: enrichedScan.outputTokens || prev.scanStats?.outputTokens || 0,
        inputTokens: enrichedScan.inputTokens || prev.scanStats?.inputTokens || 0,
        cost: enrichedScan.cost || prev.scanStats?.cost || 0,
        durationSec: enrichedScan.durationSec || prev.scanStats?.durationSec || 240,
        currentAgent: 'Autonomous VAPT Agent'
      },
      activeScanId: enrichedScan.id,
      scanFinished: true,
      outputFolderPath: enrichedScan.metadata?.remoteRunDir || enrichedScan.outputFolderPath || prev.outputFolderPath
    }));

    if (shouldNavigate) {
      setActiveTab('overview');
    }

    // Trigger Multi-Channel Scan Completion Intimations (Audio, Desktop Notification, and Floating Toast)
    playNotificationChime();
    sendDesktopNotification(
      `🛡️ VAPT Scan Complete: ${enrichedScan.companyName || 'Target'}`,
      `Audit completed successfully! ${resolvedVulns.length} verified vulnerabilities ingested and executive report is ready.`
    );
    setScanToast({
      companyName: enrichedScan.companyName || 'Target',
      targetUrl: enrichedScan.targetUrl,
      vulnCount: resolvedVulns.length,
      id: enrichedScan.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  // Handle User Login & Logout
  const handleLoginSuccess = (user) => {
    setAuthUser(user);
    const history = getStoredScanHistory();
    const visible = user.role === 'admin'
      ? history
      : history.filter(s => (s.createdBy || s.scannedBy || '').toLowerCase() === user.username.toLowerCase());

    if (visible.length > 0) {
      setActiveScanId(visible[0].id);
      localStorage.setItem('sennovate_last_active_scan_id', visible[0].id);
    } else {
      setActiveScanId('');
      localStorage.removeItem('sennovate_last_active_scan_id');
    }

    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('overview');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setAuthUser(null);
  };

  // Handle syncing all remote runs from the server
  const handleSyncAllServerScans = (runs) => {
    if (!runs || runs.length === 0) return;
    
    setScanHistory(prevHistory => {
      const runMap = new Map();
      for (const r of runs) {
        runMap.set(r.id, r);
      }
      for (const s of prevHistory) {
        if (!runMap.has(s.id)) {
          runMap.set(s.id, s);
        } else {
          const remote = runMap.get(s.id);
          const hasRemoteVulns = remote.vulnerabilities && remote.vulnerabilities.length > 0;
          const hasLocalVulns = s.vulnerabilities && s.vulnerabilities.length > 0;
          runMap.set(s.id, {
            ...s,
            ...remote,
            vulnerabilities: hasRemoteVulns ? remote.vulnerabilities : (hasLocalVulns ? s.vulnerabilities : [])
          });
        }
      }
      const merged = Array.from(runMap.values());
      saveScanHistory(merged);

      if (merged.length > 0) {
        const currentActive = merged.find(s => s.id === activeScanId) || merged[0];
        setActiveScanId(currentActive.id);
      }
      return merged;
    });
  };

  // Handle clicking on a finding card to open deep modal
  const handleSelectVuln = (vuln) => {
    setSelectedVuln(vuln);
    setIsModalOpen(true);
  };

  // Handle loading custom scan folder via modal (7-File Engine)
  const handleCustomDataLoaded = (vulns, metadata, extraData) => {
    let customVulns = Array.isArray(vulns) ? vulns : (vulns?.vulnerabilities || []);
    let customMeta = metadata || vulns?.metadata || {};
    let extra = extraData || {};

    const highCount = customVulns.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length;
    const medCount = customVulns.filter(v => v.severity === 'MEDIUM').length;

    let targetUrlVal = customMeta.targetUrl || extra.targetUrl || "https://custom-target.com/";
    let companyNameVal = customMeta.companyName || extra.companyName || "";
    if (!companyNameVal) {
      try {
        let hostname = targetUrlVal.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
        if (hostname.startsWith('www.')) hostname = hostname.slice(4);
        const nameParts = hostname.split('.');
        companyNameVal = nameParts[0] ? (nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) + ' Inc') : "Custom Target";
      } catch (e) {
        companyNameVal = "Custom Scan Target";
      }
    }

    const resolvedId = customMeta.runId || extra.folderName || `scan-${Date.now()}`;

    const newScanEntry = {
      id: resolvedId,
      folderName: extra.folderName || resolvedId,
      outputFolderPath: extra.outputFolderPath || customMeta.remoteRunDir || '',
      companyName: companyNameVal,
      targetUrl: targetUrlVal,
      timestamp: customMeta.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 16),
      duration: extra.duration || '38 min',
      riskLevel: customMeta.overallRiskLevel || (highCount > 0 ? "HIGH" : "ELEVATED"),
      riskScore: customMeta.overallRiskScore || (highCount > 0 ? 8.2 : 6.5),
      findingsCount: customVulns.length,
      highCount: highCount,
      medCount: medCount,
      lowCount: customVulns.filter(v => v.severity === 'LOW' || v.severity === 'INFO').length || 0,
      tokens: extra.tokens || customMeta.tokens || 0,
      requests: extra.requests || customMeta.requests || 0,
      cost: extra.cost || customMeta.cost || 0,
      vulnerabilities: customVulns,
      subdomains: extra.subdomains || [],
      reportMarkdown: extra.reportMarkdown || '',
      csvData: extra.csvData || '',
      sarifData: extra.sarifData || null,
      vulnerabilitiesJson: extra.vulnerabilitiesJson || null,
      metadata: {
        ...SCAN_METADATA,
        ...customMeta,
        companyName: companyNameVal,
        targetUrl: targetUrlVal,
        testedSubdomains: extra.subdomains || []
      }
    };

    handleSaveNewScan(newScanEntry, true);
    setIsDataLoaderOpen(false);
  };

  // Derived active scan parameters with robust fallback
  const resolveScanFindings = (scan) => {
    if (!scan) return [];
    if (scan.vulnerabilities && Array.isArray(scan.vulnerabilities) && scan.vulnerabilities.length > 0) {
      return scan.vulnerabilities;
    }
    if (scan.id === 'www-emcochem-com_406f') {
      return EMCOCHEM_VULNERABILITIES;
    }
    if (scan.id === 'www-smeco-coop_81f4') {
      return SMECO_VULNERABILITIES;
    }
    if (scan.id === 'www-vontier-com_93f0') {
      return VULNERABILITIES;
    }
    return Array.isArray(scan.vulnerabilities) ? scan.vulnerabilities : [];
  };

  const currentVulnerabilities = resolveScanFindings(activeScan);
  const currentMetadata = activeScan ? {
    ...(activeScan.metadata || SCAN_METADATA),
    targetUrl: activeScan.targetUrl || (activeScan.metadata?.targetUrl || ""),
    companyName: activeScan.companyName || (activeScan.metadata?.companyName || "Target Organization"),
    createdBy: activeScan.createdBy || (currentUser?.username || 'admin'),
    scannedBy: activeScan.scannedBy || activeScan.createdBy || (currentUser?.username || 'user'),
    scannedByName: activeScan.scannedByName || (currentUser?.role === 'admin' ? 'Administrator' : 'User'),
    totalFindings: currentVulnerabilities.length,
    highCount: currentVulnerabilities.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length,
    medCount: currentVulnerabilities.filter(v => v.severity === 'MEDIUM').length,
    overallRiskScore: currentVulnerabilities.length > 0 ? (currentVulnerabilities[0]?.cvss || 5.5) : (activeScan.riskScore || 0),
    overallRiskLevel: currentVulnerabilities.some(v => v.severity === 'HIGH' || v.severity === 'CRITICAL') ? 'HIGH' : (currentVulnerabilities.length > 0 ? 'ELEVATED' : (activeScan.riskLevel || 'LOW')),
    tokens: typeof activeScan.tokens === 'number' ? activeScan.tokens : (typeof activeScan.metadata?.tokens === 'number' ? activeScan.metadata.tokens : 0),
    requests: typeof activeScan.requests === 'number' ? activeScan.requests : (typeof activeScan.metadata?.requests === 'number' ? activeScan.metadata.requests : 0),
    cost: typeof activeScan.cost === 'number' ? activeScan.cost : (typeof activeScan.metadata?.cost === 'number' ? activeScan.metadata.cost : 0),
    testedSubdomains: activeScan.metadata?.testedSubdomains || activeScan.subdomains || [],
    subdomains: activeScan.metadata?.testedSubdomains || activeScan.subdomains || []
  } : {
    ...SCAN_METADATA,
    targetUrl: '',
    companyName: currentUser?.role === 'admin' ? 'Sennovate Autonomous Security' : 'My Security Audits',
    totalFindings: 0,
    highCount: 0,
    medCount: 0,
    overallRiskScore: 0,
    overallRiskLevel: 'NONE',
    tokens: 0,
    requests: 0,
    cost: 0,
    testedSubdomains: [],
    subdomains: []
  };
  const currentCompanyName = currentMetadata.companyName;
  const currentTargetUrl = currentMetadata.targetUrl;
  const currentRiskLevel = currentMetadata.overallRiskLevel;
  const currentRiskScore = currentMetadata.overallRiskScore;

  // Unauthenticated Guard: Show Login Screen if no active session
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} />;
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#060A13] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        isScanning={isScanning}
        theme={theme}
        toggleTheme={toggleTheme}
        onTriggerScan={() => setActiveTab('scan')}
        onOpenDataLoader={() => setIsDataLoaderOpen(true)}
        onOpenLlmSettings={() => setIsLlmSettingsOpen(true)}
        onOpenStrixSettings={() => setIsStrixSettingsOpen(true)}
        vulnerabilitiesCount={currentVulnerabilities.length}
        scanHistoryCount={visibleScanHistory.length}
        companyName={currentCompanyName}
        targetUrl={currentTargetUrl}
        riskLevel={currentRiskLevel}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen">
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
          isScanning={isScanning}
          onTriggerScan={() => setActiveTab('scan')}
          onOpenLlmSettings={() => setIsLlmSettingsOpen(true)}
          onOpenStrixSettings={() => setIsStrixSettingsOpen(true)}
          companyName={currentCompanyName}
          targetUrl={currentTargetUrl}
          riskLevel={currentRiskLevel}
          riskScore={currentRiskScore}
        />

        {/* Tab Pages */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {/* Admin User Management & Audit Portal (Admin Only) */}
          {activeTab === 'admin' && currentUser?.role === 'admin' && (
            <AdminUserManagement
              currentUser={currentUser}
              scanHistory={scanHistory}
              onSelectScan={(scan) => handleSelectScan(scan, false)}
              theme={theme}
            />
          )}

          {activeTab === 'overview' && (
            <DashboardOverview
              vulnerabilities={currentVulnerabilities}
              metadata={currentMetadata}
              activeScan={activeScan}
              currentUser={currentUser}
              companyName={currentCompanyName}
              scanHistory={visibleScanHistory}
              activeScanId={activeScanId}
              onSelectScan={handleSelectScan}
              onSelectFinding={handleSelectVuln}
              onViewAttackChain={() => setActiveTab('attack-chain')}
              onOpenChatbot={(prompt) => {
                setActiveTab('chatbot');
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
              theme={theme}
            />
          )}

          {/* AI Target Scanner HUD View */}
          <div className={activeTab === 'scan' ? 'block' : 'hidden'}>
            <ScanHud
              isScanning={isScanning}
              setIsScanning={setIsScanning}
              currentUser={currentUser}
              scannerState={scannerState}
              setScannerState={setScannerState}
              activeScan={activeScan}
              activeScanId={activeScanId}
              scanHistory={visibleScanHistory}
              onScanCompleted={() => {}}
              onViewFindings={() => {
                if (activeScanId) {
                  const match = visibleScanHistory.find(s => s.id === activeScanId);
                  if (match) {
                    handleSelectScan(match, false);
                  } else if (visibleScanHistory.length > 0) {
                    handleSelectScan(visibleScanHistory[0], false);
                  } else {
                    setActiveTab('overview');
                  }
                } else if (visibleScanHistory.length > 0) {
                  handleSelectScan(visibleScanHistory[0], false);
                } else {
                  setActiveTab('overview');
                }
              }}
              onSaveNewScan={handleSaveNewScan}
              onOpenStrixSettings={() => setIsStrixSettingsOpen(true)}
              theme={theme}
            />
          </div>

          {activeTab === 'history' && (
            <ScanHistory
              scanHistory={visibleScanHistory}
              activeScanId={activeScanId}
              onSelectScan={(scan) => handleSelectScan(scan, false)}
              onDeleteScan={handleDeleteScan}
              onTriggerNewScan={() => setActiveTab('scan')}
              onSyncAllServerScans={handleSyncAllServerScans}
              theme={theme}
            />
          )}

          {activeTab === 'vulnerabilities' && (
            <VulnerabilityList
              vulnerabilities={currentVulnerabilities}
              onSelectFinding={handleSelectVuln}
              scanHistory={visibleScanHistory}
              activeScanId={activeScanId}
              onSelectScan={handleSelectScan}
              companyName={currentCompanyName}
              targetUrl={currentTargetUrl}
              theme={theme}
            />
          )}

          {activeTab === 'attack-chain' && (
            <AttackChainView
              onSelectVuln={handleSelectVuln}
              activeScan={activeScan}
              companyName={currentCompanyName}
              targetUrl={currentTargetUrl}
              vulnerabilities={currentVulnerabilities}
              scanHistory={visibleScanHistory}
              activeScanId={activeScanId}
              onSelectScan={handleSelectScan}
              theme={theme}
            />
          )}

          {activeTab === 'chatbot' && (
            <Chatbot
              theme={theme}
              isFullPage={true}
              companyName={currentCompanyName}
              targetUrl={currentTargetUrl}
              vulnerabilities={currentVulnerabilities}
              onOpenLlmSettings={() => setIsLlmSettingsOpen(true)}
            />
          )}

          {activeTab === 'report' && (
            <PdfReport
              vulnerabilities={currentVulnerabilities}
              metadata={currentMetadata}
              companyName={currentCompanyName}
              theme={theme}
            />
          )}
        </main>
      </div>

      {/* Deep Finding Inspection Modal */}
      <VulnerabilityModal
        vuln={selectedVuln}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        theme={theme}
      />

      {/* Dynamic Scan Data Loader Modal */}
      <ScanDataLoader
        isOpen={isDataLoaderOpen}
        onClose={() => setIsDataLoaderOpen(false)}
        onDataLoaded={handleCustomDataLoaded}
        theme={theme}
      />

      {/* Custom LLM API Key Settings Modal */}
      <LlmSettingsModal
        isOpen={isLlmSettingsOpen}
        onClose={() => setIsLlmSettingsOpen(false)}
        theme={theme}
      />

      {/* SSH Server Settings Modal */}
      <StrixConnectionModal
        isOpen={isStrixSettingsOpen}
        onClose={() => setIsStrixSettingsOpen(false)}
        theme={theme}
      />

      {/* Real-Time Scan Completion Intimation Toast Banner */}
      {scanToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 ${
            theme === 'dark'
              ? 'bg-[#0E172B]/95 border-emerald-500/40 text-slate-100 shadow-emerald-950/50'
              : 'bg-white/95 border-emerald-500 text-slate-900 shadow-emerald-200/50'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 animate-pulse" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Scan Audit Completed &bull; {scanToast.timestamp}</span>
                </div>
                <button 
                  onClick={() => setScanToast(null)}
                  className="text-slate-400 hover:text-slate-200 text-sm p-1 leading-none"
                >
                  &times;
                </button>
              </div>

              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {scanToast.companyName} Assessment Finished!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
                {scanToast.vulnCount} verified vulnerabilities ingested from server. Dashboard overview and PDF deliverable are ready.
              </p>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveTab('overview');
                    setScanToast(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-colors shadow-sm"
                >
                  View Dashboard &rarr;
                </button>
                <button
                  onClick={() => {
                    setActiveTab('report');
                    setScanToast(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs font-mono transition-colors border border-slate-300 dark:border-slate-700"
                >
                  Open Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
