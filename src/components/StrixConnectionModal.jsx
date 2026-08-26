import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Terminal, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  FolderOpen, 
  Lock, 
  Eye, 
  EyeOff, 
  Cpu, 
  ShieldCheck, 
  Globe, 
  Sparkles, 
  Zap,
  Webhook,
  Radio
} from 'lucide-react';
import { 
  getStrixServerConfig, 
  saveStrixServerConfig, 
  testStrixSshConnection,
  triggerN8nScan,
  testN8nFetchWebhookApi
} from '../utils/strixApi';

export default function StrixConnectionModal({ isOpen, onClose, onConnected, theme = 'dark' }) {
  const [config, setConfig] = useState(() => getStrixServerConfig());
  const [activeTab, setActiveTab] = useState(() => config.triggerMode || 'n8n');
  const [showPassword, setShowPassword] = useState(false);
  const [showN8nPassword, setShowN8nPassword] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fetchTestDomain, setFetchTestDomain] = useState('sennovate.com');
  const [testingFetch, setTestingFetch] = useState(false);
  const [fetchTestResult, setFetchTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const saved = getStrixServerConfig();
      setConfig(saved);
      setActiveTab(saved.triggerMode || 'n8n');
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setSaveSuccess(false);

    if (activeTab === 'n8n') {
      try {
        const effCred = config.n8nCredential || (config.n8nUsername && config.n8nPassword ? `${config.n8nUsername}:${config.n8nPassword}` : (config.n8nUsername || config.n8nPassword || ''));
        const result = await triggerN8nScan({
          webhookUrl: config.n8nWebhookUrl,
          domain: 'smeco.coop',
          authType: config.n8nAuthType || 'basic',
          credential: effCred,
          username: config.n8nUsername,
          password: config.n8nPassword,
          token: config.n8nToken
        });
        setTestResult({
          success: true,
          message: `Successfully connected to n8n Webhook! Trigger verified for domain: smeco.coop.`
        });
      } catch (err) {
        setTestResult({
          success: false,
          message: `n8n Webhook Error: ${err.message || 'Check Webhook URL and credentials'}`
        });
      } finally {
        setTesting(false);
      }
      return;
    }

    try {
      const result = await testStrixSshConnection(config);
      setTestResult(result);
      if (result.success && onConnected) {
        onConnected(config);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'SSH Connection Failed. Verify IP, user, and credentials.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestFetchWebhook = async () => {
    setTestingFetch(true);
    setFetchTestResult(null);

    const effCred = config.n8nCredential || (config.n8nUsername && config.n8nPassword ? `${config.n8nUsername}:${config.n8nPassword}` : (config.n8nUsername || config.n8nPassword || ''));
    try {
      const res = await testN8nFetchWebhookApi({
        webhookUrl: config.n8nFetchWebhookUrl,
        domain: fetchTestDomain || 'sennovate.com',
        authType: config.n8nAuthType || 'basic',
        credential: effCred,
        username: config.n8nUsername,
        password: config.n8nPassword,
        token: config.n8nToken
      });
      setFetchTestResult(res);
    } catch (err) {
      setFetchTestResult({
        success: false,
        status: 0,
        message: err.message || 'Failed to connect to n8n Fetch Webhook'
      });
    } finally {
      setTestingFetch(false);
    }
  };

  const handleSave = () => {
    const updated = { ...config, triggerMode: activeTab };
    saveStrixServerConfig(updated);
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all max-h-[90vh] flex flex-col ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          theme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
              {activeTab === 'n8n' ? <Webhook className="w-5 h-5" /> : <Server className="w-5 h-5" />}
            </div>
            <div>
              <h3 className={`font-bold text-base font-sans flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-950'
              }`}>
                <span>Scanner Trigger &amp; Integration Settings</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono font-normal">
                  {activeTab === 'n8n' ? 'n8n Public Webhook' : 'Direct Server SSH'}
                </span>
              </h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Configure how the dashboard triggers Strix penetration testing scans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={`flex items-center gap-2 px-6 pt-4 border-b ${
          theme === 'dark' ? 'border-slate-800/60 bg-[#080E1C]/50' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <button
            type="button"
            onClick={() => { setActiveTab('n8n'); setTestResult(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-mono font-bold border-b-2 transition-all ${
              activeTab === 'n8n'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Webhook className="w-4 h-4" />
            <span>n8n Webhook (Any Wi-Fi / Remote Demo)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('ssh'); setTestResult(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-mono font-bold border-b-2 transition-all ${
              activeTab === 'ssh'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Direct Server SSH (Corp Wi-Fi / VPN)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
          {activeTab === 'n8n' ? (
            /* n8n Webhook Configuration Tab */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#050914] border border-cyan-500/30 font-mono text-xs text-slate-300 space-y-2.5">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-800">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Remote Demo Trigger (Works from Any Network / Wi-Fi):</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  The dashboard extracts the <strong>Target Domain</strong> from your HUD input (e.g. <code className="text-cyan-400">https://www.smeco.coop/</code> &rarr; <code className="text-cyan-400">smeco.coop</code>) and sends an HTTPS POST request to your corporate n8n webhook with the configured credentials.
                </p>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-sans">
                  <strong>Important:</strong> The <code>"domain"</code> in the webhook payload is the <strong>target website being audited/scanned</strong>, <em>not</em> your localhost URL. Running the dashboard on localhost works seamlessly because the HTTPS webhook is public.
                </div>
              </div>

              {/* Webhook URLs Grid */}
              <div className="grid grid-cols-1 gap-3">
                {/* 1. Trigger Webhook URL */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-500" />
                      <span>1. Trigger Scan Webhook URL:</span>
                    </span>
                    <span className="text-[10px] text-cyan-400 font-normal">Starts Scan on Server</span>
                  </label>
                  <input
                    type="text"
                    value={config.n8nWebhookUrl || ''}
                    onChange={(e) => setConfig({ ...config, n8nWebhookUrl: e.target.value })}
                    placeholder="https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/8fdd9fff..."
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* 2. Fetch / Download Results Webhook URL */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                      <span>2. Fetch & Download Scan ZIP Webhook URL:</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-normal">Downloads & Ingests ZIP</span>
                  </label>
                  <input
                    type="text"
                    value={config.n8nFetchWebhookUrl || 'https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/1bc30fe0-e31f-4cdb-91fd-d15d4f20ede3'}
                    onChange={(e) => setConfig({ ...config, n8nFetchWebhookUrl: e.target.value })}
                    placeholder="https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/1bc30fe0-e31f-4cdb-91fd-d15d4f20ede3"
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Authentication Type */}
              <div className="space-y-1.5">
                <label className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                }`}>
                  <Lock className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Authentication Method:</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'basic', label: 'Basic Auth (User + Pass)' },
                    { id: 'bearer', label: 'Bearer Token' },
                    { id: 'none', label: 'No Auth (Public)' }
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setConfig({ ...config, n8nAuthType: method.id })}
                      className={`py-2 px-3 rounded-xl font-mono text-xs font-bold border transition-all text-center ${
                        (config.n8nAuthType || 'basic') === method.id
                          ? 'border-cyan-400 bg-cyan-500/15 text-cyan-400'
                          : theme === 'dark'
                          ? 'border-slate-800 bg-[#080E1C] text-slate-400 hover:text-slate-200'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Credentials Fields */}
              {(config.n8nAuthType || 'basic') === 'basic' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                    }`}>
                      <span>Webhook Credential string (-u '...'):</span>
                      <span className="text-[10px] text-cyan-400 font-normal">e.g. strix:a+b=c</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showN8nPassword ? 'text' : 'password'}
                        value={config.n8nCredential !== undefined ? config.n8nCredential : (config.n8nUsername && config.n8nPassword ? `${config.n8nUsername}:${config.n8nPassword}` : (config.n8nUsername || config.n8nPassword || ''))}
                        onChange={(e) => setConfig({ ...config, n8nCredential: e.target.value })}
                        placeholder="e.g. strix:a+b=c or user:password"
                        className={`w-full px-3.5 py-2.5 pr-10 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                          theme === 'dark'
                            ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                            : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowN8nPassword(!showN8nPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      >
                        {showN8nPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans">
                      Matches <code>-u 'credential'</code> in curl. Enter your exact credential string (e.g. <code>strix:a+b=c</code>).
                    </p>
                  </div>
                </div>
              )}

              {(config.n8nAuthType === 'bearer') && (
                <div className="space-y-1.5 pt-1">
                  <label className={`text-[11px] font-mono font-bold ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
                  }`}>
                    Bearer / API Token:
                  </label>
                  <input
                    type="password"
                    value={config.n8nToken || ''}
                    onChange={(e) => setConfig({ ...config, n8nToken: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    }`}
                  />
                </div>
              )}

              {/* Dedicated Checking Configuration & Server Root File Fetch Test Box */}
              <div className="p-3.5 rounded-xl bg-[#060A16] border border-cyan-500/40 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Check Server Root File & Webhook Connectivity:</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Fetch any file / path from /root</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Target Domain or Server File Path (from /root):</span>
                    <span className="text-cyan-400">e.g. /root/strix.log or sennovate.com</span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'sennovate.com (Scan ZIP)', val: 'sennovate.com' },
                      { label: 'smeco.coop (Scan ZIP)', val: 'smeco.coop' },
                      { label: 'smeco-scan', val: 'smeco-scan' },
                      { label: '/root/strix.log', val: '/root/strix.log' },
                      { label: 'penetration_test_report.md', val: 'penetration_test_report.md' },
                      { label: 'run.json', val: 'run.json' }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setFetchTestDomain(preset.val)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-all cursor-pointer ${
                          fetchTestDomain === preset.val 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                            : 'bg-[#040813] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fetchTestDomain}
                      onChange={(e) => setFetchTestDomain(e.target.value)}
                      placeholder="e.g. /root/strix.log, penetration_test_report.md, or sennovate.com"
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none transition-all ${
                        theme === 'dark'
                          ? 'bg-[#03060E] border border-slate-700 text-cyan-300 placeholder-slate-500 focus:border-cyan-400'
                          : 'bg-white border border-slate-300 text-cyan-800 placeholder-slate-400 focus:border-cyan-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleTestFetchWebhook}
                      disabled={testingFetch || !fetchTestDomain.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-sans transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm flex-shrink-0"
                    >
                      {testingFetch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      <span>{testingFetch ? 'Fetching...' : 'Fetch File & Check'}</span>
                    </button>
                  </div>
                </div>

                {fetchTestResult && (
                  <div className={`p-3 rounded-xl border text-[11px] font-mono space-y-2 ${
                    fetchTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <div className="font-bold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {fetchTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                        <span>{fetchTestResult.message}</span>
                      </div>
                      {fetchTestResult.fileCategory && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                          {fetchTestResult.fileCategory}
                        </span>
                      )}
                    </div>

                    {fetchTestResult.sizeFormatted && (
                      <div className="text-[10px] text-slate-300 flex flex-wrap gap-x-4 gap-y-1 pt-0.5 border-t border-slate-800/80">
                        <span>Payload Size: <strong className="text-cyan-300">{fetchTestResult.sizeFormatted}</strong></span>
                        {fetchTestResult.lineCount && <span>Lines: <strong className="text-amber-300">{fetchTestResult.lineCount}</strong></span>}
                        {fetchTestResult.savedLocalPath && (
                          <span className="text-emerald-400 font-sans">
                            Saved locally: <code>{fetchTestResult.savedLocalPath}</code>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Live Server File Content Preview Box */}
                    {fetchTestResult.preview && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                          <span>Live Server File Content Preview:</span>
                          <span className="text-[9px] text-cyan-400">First 3,000 chars</span>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-[#02050C] border border-slate-800 text-slate-200 text-[10px] font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                          {fetchTestResult.preview}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dual cURL Preview Box */}
              <div className="p-3.5 rounded-xl bg-[#040711] border border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="text-slate-500 font-bold uppercase text-[10px] flex items-center justify-between">
                  <span>cURL Command Payload Formats:</span>
                  <span className="text-cyan-400 font-bold">HTTPS POST</span>
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <span className="text-cyan-400"># 1. Trigger Scan:</span>
                  </span>
                  <code className="block text-cyan-300/90 whitespace-pre-wrap break-all leading-relaxed p-2 rounded bg-[#02050C] border border-slate-800/80">
                    curl -X POST \{'\n'}
                    &nbsp;&nbsp;'{config.n8nWebhookUrl || 'https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/...'}' \{'\n'}
                    {config.n8nAuthType === 'basic' ? `  -u '${config.n8nCredential ? (showN8nPassword ? config.n8nCredential : config.n8nCredential.replace(/./g, '•')) : 'strix:a+b=c'}' \\\n` : ''}
                    &nbsp;&nbsp;-H 'Content-Type: application/json' \{'\n'}
                    &nbsp;&nbsp;-d '{'{"domain": "sennovate.com"}'}'
                  </code>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <span className="text-emerald-400"># 2. Fetch & Download Scan ZIP:</span>
                  </span>
                  <code className="block text-emerald-300/90 whitespace-pre-wrap break-all leading-relaxed p-2 rounded bg-[#02050C] border border-slate-800/80">
                    curl -X POST \{'\n'}
                    &nbsp;&nbsp;'{config.n8nFetchWebhookUrl || 'https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/1bc30fe0-e31f-4cdb-91fd-d15d4f20ede3'}' \{'\n'}
                    {config.n8nAuthType === 'basic' ? `  -u '${config.n8nCredential ? (showN8nPassword ? config.n8nCredential : config.n8nCredential.replace(/./g, '•')) : 'strix:a+b=c'}' \\\n` : ''}
                    &nbsp;&nbsp;-H 'Content-Type: application/json' \{'\n'}
                    &nbsp;&nbsp;-d '{'{"domain": "sennovate.com"}'}' \{'\n'}
                    &nbsp;&nbsp;-o sennovate.com-scan.zip
                  </code>
                </div>
              </div>
            </div>
          ) : (
            /* Direct Server SSH Tab */
            <div className="space-y-4">
              {/* Exact 3-Step Execution Sequence Terminal Card */}
              <div className="p-4 rounded-xl bg-[#050914] border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-800">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Automated 3-Step Terminal Flow:</span>
                </div>
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-cyan-400 font-bold">Step 1:</span>
                    <code>ssh {config.username || 'ubuntu'}@{config.host || '&lt;server-ip&gt;'}</code>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-emerald-400 font-bold">Step 2:</span>
                    <code>{config.username || 'ubuntu'}@server:~$ sudo -i</code>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-amber-400 font-bold">Step 3:</span>
                    <code className="text-emerald-300 font-bold">root@server:~# strix -t &lt;target-url&gt; -n</code>
                  </div>
                </div>
              </div>

              {/* SSH Host & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    <Globe className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Ubuntu Server IP / Hostname:</span>
                  </label>
                  <input
                    type="text"
                    value={config.host || ''}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="e.g. 10.0.8.193"
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-bold ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    SSH Port:
                  </label>
                  <input
                    type="number"
                    value={config.port || 22}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 22 })}
                    placeholder="22"
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white focus:border-cyan-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>

              {/* SSH Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                    <span>SSH Username (Step 1):</span>
                  </label>
                  <input
                    type="text"
                    value={config.username || 'ubuntu'}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    placeholder="ubuntu"
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Password (for SSH &amp; sudo):</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={config.password || ''}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      placeholder="Server user password"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                        theme === 'dark'
                          ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                          : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI LLM Provider Configuration */}
              <div className={`space-y-3 pt-2 border-t ${
                theme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI LLM Provider Configuration:</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={`text-[11px] font-mono font-bold ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
                    }`}>
                      Agent Model Name:
                    </label>
                    <input
                      type="text"
                      value={config.strixLlm || ''}
                      onChange={(e) => setConfig({ ...config, strixLlm: e.target.value })}
                      placeholder="e.g. openrouter/deepseek/deepseek-v4-flash"
                      className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                        theme === 'dark'
                          ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                          : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[11px] font-mono font-bold ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
                    }`}>
                      LLM_API_KEY (Optional override):
                    </label>
                    <div className="relative">
                      <input
                        type={showLlmKey ? 'text' : 'password'}
                        value={config.llmApiKey || ''}
                        onChange={(e) => setConfig({ ...config, llmApiKey: e.target.value })}
                        placeholder="API key override"
                        className={`w-full px-3.5 py-2.5 pr-10 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                          theme === 'dark'
                            ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                            : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLlmKey(!showLlmKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        {showLlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Connection Result Box */}
          {testResult && (
            <div className={`p-3.5 rounded-xl text-xs font-mono flex items-start gap-2.5 border ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
            }`}>
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {testResult.message}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-5 border-t flex items-center justify-between gap-3 ${
          theme === 'dark' ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            onClick={handleTestConnection}
            disabled={testing || (activeTab === 'ssh' && !config.host) || (activeTab === 'n8n' && !config.n8nWebhookUrl)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
              theme === 'dark'
                ? 'bg-[#0E172B] hover:bg-[#152342] border-slate-700 text-slate-200'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-sm'
            }`}
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5 text-cyan-500" />
                <span>{activeTab === 'n8n' ? 'Test n8n Webhook' : 'Test SSH Server'}</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-mono transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-sans font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md transition-all"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
