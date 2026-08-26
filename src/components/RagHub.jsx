import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Search, 
  FileText, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Cpu, 
  ArrowRight,
  Database,
  Send,
  Zap
} from 'lucide-react';
import { generateRagSynthesis, KNOWLEDGE_BASE_CHUNKS, searchKnowledgeBase } from '../utils/ragEngine';

export default function RagHub({ initialQuery = '', onSelectVulnById }) {
  const [query, setQuery] = useState(initialQuery || 'Generate C-Suite Executive Summary');
  const [ragResult, setRagResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState(null);

  const presetQueries = [
    { title: 'C-Suite Executive Summary', q: 'Generate C-Suite Executive Summary for Vontier.com' },
    { title: 'DOM XSS & Redirect Exploit Chain', q: 'Explain the DOM XSS via postMessage and Open Redirect Attack Chain' },
    { title: 'DevOps Remediation Roadmap', q: 'Provide a prioritized remediation checklist for engineering and DevOps' },
    { title: 'Information Disclosure Risks', q: 'Summarize Drupal version disclosure and Absorb LMS REST API exposure' }
  ];

  const handleRunQuery = (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const result = generateRagSynthesis(q);
      setRagResult(result);
      setIsGenerating(false);
    }, 400);
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleRunQuery(initialQuery);
    } else if (!ragResult) {
      handleRunQuery('Generate C-Suite Executive Summary');
    }
  }, [initialQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* RAG Engine Hero Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Retrieval-Augmented Generation (RAG) Security Intelligence
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Sennovate AI Threat Intelligence Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Vector search across all 7 vulnerability markdown files, executive report sections, and scan telemetry with grounded markdown citations.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#080E1C] border border-slate-800 text-xs font-mono text-cyan-300">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Indexed Chunks: <strong className="text-white">{KNOWLEDGE_BASE_CHUNKS.length} Documents</strong></span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Bot className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunQuery(query)}
              placeholder="Ask any question regarding vulnerabilities, impact, or remediation..."
              className="w-full pl-12 pr-4 py-3.5 bg-[#080E1C] border border-slate-700/80 rounded-xl text-slate-100 font-mono text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
            />
          </div>

          <button
            onClick={() => handleRunQuery(query)}
            disabled={isGenerating || !query.trim()}
            className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-xs font-mono transition-all ${
              isGenerating
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-wait'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md'
            }`}
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Synthesize</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-slate-400">Quick Syntheses:</span>
          {presetQueries.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(p.q);
                handleRunQuery(p.q);
              }}
              className="px-3 py-1 rounded-lg bg-[#080E1C] hover:bg-[#10192F] text-cyan-300 border border-slate-800 hover:border-cyan-500/50 text-xs font-mono transition-all"
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* RAG Synthesis Results */}
      {ragResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Synthesis Summary Card */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Grounded AI Synthesis</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                100% Grounded
              </span>
            </div>

            {/* Insight Box */}
            <div className="p-4 rounded-xl bg-[#0E162B] border border-slate-700/80 space-y-1.5">
              <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase">Executive Insight</div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                {ragResult.summary}
              </p>
            </div>

            {/* Key Findings */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Key Grounded Observations
              </h4>
              <div className="space-y-2">
                {ragResult.keyTakeaways.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#080E1C] border border-slate-800 text-xs sm:text-sm text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed font-sans">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Action Items */}
            {ragResult.actionItems && ragResult.actionItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Prioritized Remediation Actions
                </h4>
                <div className="space-y-2">
                  {ragResult.actionItems.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed font-sans">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Citations Inspector */}
          <div className="p-6 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Retrieved Citations</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Top {ragResult.retrievedChunks.length} Chunks
              </span>
            </div>

            <div className="space-y-3">
              {ragResult.retrievedChunks.map((chunk, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedChunk(chunk)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedChunk?.id === chunk.id
                      ? 'bg-[#0F1C38] border-cyan-400'
                      : 'bg-[#080E1C] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white line-clamp-1">{chunk.title}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">
                      {chunk.score}%
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-cyan-400 mb-1">
                    {chunk.source} &bull; {chunk.lines}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>

            {selectedChunk && (
              <div className="p-4 rounded-xl bg-[#070D1A] border border-cyan-800 space-y-2 mt-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 font-bold">
                  <span>Full Citation</span>
                  <button onClick={() => setSelectedChunk(null)} className="text-slate-400 hover:text-white">
                    Close
                  </button>
                </div>
                <div className="text-xs font-bold text-white">{selectedChunk.title}</div>
                <div className="text-[10px] font-mono text-slate-400">{selectedChunk.source} ({selectedChunk.lines})</div>
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {selectedChunk.content}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
