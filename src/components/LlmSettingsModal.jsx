import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Cpu, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Server, 
  Globe, 
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  Terminal,
  Zap,
  Info,
  Layers
} from 'lucide-react';
import { getLlmConfig, saveLlmConfig, testLlmConnection, USER_REQUESTED_MODELS } from '../utils/llmEngine';

export default function LlmSettingsModal({ isOpen, onClose, theme = 'dark' }) {
  const [config, setConfig] = useState(() => getLlmConfig());
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getLlmConfig());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Preset Configurations
  const presets = [
    {
      id: 'groq',
      name: 'Groq Cloud',
      providerName: 'Groq Cloud',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      keyPlaceholder: 'gsk_...',
      useCustom: true,
      badge: 'Groq'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      providerName: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: 'gemini-2.5-flash',
      keyPlaceholder: 'AIzaSy...',
      useCustom: true,
      badge: 'Google'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      providerName: 'OpenRouter AI',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-oss-120b',
      keyPlaceholder: 'sk-or-v1-...',
      useCustom: true,
      badge: 'OpenRouter'
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      providerName: 'OpenAI Official',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      keyPlaceholder: 'sk-proj-...',
      useCustom: true,
      badge: 'OpenAI'
    },
    {
      id: 'free-puter',
      name: 'Free Puter AI (Zero Key)',
      providerName: 'Free Puter AI Bridge',
      baseUrl: '',
      defaultModel: 'claude-3-5-sonnet',
      keyPlaceholder: 'No API key required',
      useCustom: false,
      badge: 'Free'
    },
    {
      id: 'custom',
      name: 'Custom Endpoint',
      providerName: 'Custom OpenAI-Compatible API',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'custom-model',
      keyPlaceholder: 'Your API key',
      useCustom: true,
      badge: 'Custom'
    }
  ];

  const handleApplyPreset = (preset) => {
    setConfig(prev => ({
      ...prev,
      providerName: preset.providerName,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      useCustomEndpoint: preset.useCustom
    }));
    setTestResult(null);
  };

  const handleSelectModel = (modelObj) => {
    setConfig(prev => ({
      ...prev,
      model: modelObj.id,
      baseUrl: prev.baseUrl || modelObj.defaultUrl,
      providerName: modelObj.provider
    }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLlmConnection(config);
      setTestResult({ success: true, message: result.message, latency: result.latency });
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveLlmConfig(config);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#0E162B] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">
                Configure Any LLM with API Key
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Supports Groq, Google Gemini, OpenRouter, OpenAI, and Custom Endpoints
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Preset Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              <span>1. Select Provider:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((p) => {
                const isActive = (p.baseUrl === config.baseUrl && p.useCustom === config.useCustomEndpoint) || (!config.baseUrl && p.id === 'free-puter');
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-sm'
                        : theme === 'dark'
                        ? 'bg-[#080E1C] border-slate-800 hover:border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs truncate">{p.name}</span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                        {p.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate font-mono">
                      {p.defaultModel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Model Selector Pills */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              <span>2. Select Model (Or Type Any Below):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {USER_REQUESTED_MODELS.map((m) => {
                const isSelected = config.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectModel(m)}
                    className={`px-3 py-2 rounded-xl text-left font-mono text-xs transition-all border ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md'
                        : theme === 'dark'
                        ? 'bg-[#080E1C] text-slate-300 border-slate-800 hover:border-cyan-500/50 hover:bg-[#0E172C]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-cyan-500/50 hover:bg-white'
                    }`}
                  >
                    <div className="truncate font-bold text-[11px]">{m.id}</div>
                    <div className={`text-[9px] truncate ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                      {m.provider}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Configuration Fields */}
          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            {/* 1. API Base URL Input */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-500" />
                  API Base URL:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">e.g. https://api.groq.com/openai/v1</span>
              </label>
              <input
                type="text"
                value={config.baseUrl || ''}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value, useCustomEndpoint: true })}
                placeholder="https://api.groq.com/openai/v1 or https://generativelanguage.googleapis.com/v1beta/openai"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                }`}
              />
            </div>

            {/* 2. API Key Input */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-500" />
                  Your API Key:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Stored locally in browser</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value, useCustomEndpoint: true })}
                  placeholder="Paste your API key (gsk_..., AIzaSy..., sk-or-..., sk-...)"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                    theme === 'dark'
                      ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                      : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 3. Model Identifier Input */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold flex items-center justify-between ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                  Model Identifier:
                </span>
                <span className="text-[10px] text-cyan-400 font-normal">Type or select any model above</span>
              </label>
              <input
                type="text"
                value={config.model || ''}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="e.g. llama-3.3-70b-versatile, gemini-2.5-flash, openai/gpt-oss-120b"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#080E1C] border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {/* Advanced Parameters Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Advanced Sampling Parameters' : 'Show Advanced Sampling Parameters (Temperature, Max Tokens)'}</span>
            </button>

            {showAdvanced && (
              <div className={`mt-3 p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                theme === 'dark' ? 'bg-[#080E1C] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400 block">
                    Temperature (Creativity): {config.temperature || 0.3}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature !== undefined ? config.temperature : 0.3}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400 block">
                    Max Tokens:
                  </label>
                  <input
                    type="number"
                    value={config.maxTokens || 2048}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })}
                    className={`w-full px-3 py-1.5 rounded-lg font-mono text-xs focus:outline-none border ${
                      theme === 'dark' ? 'bg-[#050912] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Connection Result Box */}
          {testResult && (
            <div className={`p-3.5 rounded-xl text-xs font-mono flex items-start gap-2.5 border ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}>
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {testResult.message}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#0E162B] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all border ${
              theme === 'dark'
                ? 'bg-[#080E1C] hover:bg-slate-800 text-cyan-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-cyan-700 border-slate-300'
            }`}
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test API Connection</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all font-sans"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
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
