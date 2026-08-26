import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  X, 
  ExternalLink, 
  ShieldAlert, 
  MessageSquare, 
  HelpCircle, 
  Cpu, 
  Key, 
  SlidersHorizontal 
} from 'lucide-react';
import { askLlmWithRag, getLlmConfig } from '../utils/llmEngine';

export default function Chatbot({ 
  theme = 'dark', 
  isFullPage = false, 
  onClose,
  onOpenLlmSettings,
  companyName = "",
  targetUrl = "",
  vulnerabilities = []
}) {
  const [llmConfig, setLlmConfig] = useState(() => getLlmConfig());
  const [messages, setMessages] = useState([
    {
      id: 'msg-init',
      sender: 'bot',
      text: `Hello! I am your **AI Security Assistant** powered by RAG architecture and LLM reasoning.${targetUrl ? ` I have analyzed all confirmed security findings for **${companyName}** (${targetUrl}).` : ' Ready to assist with security audits, findings analysis, and remediation guidance.'} How can I assist you today?`,
      bulletPoints: [
        "Ask: *'What is the highest risk finding for our company?'*",
        "Ask: *'Summarize all findings in simple words'*",
        "Ask: *'How can an attacker exploit our subdomain?'*",
        "Ask: *'What are the step-by-step remediation priorities?'*"
      ],
      citations: [
        { title: "Penetration Test Report", source: "penetration_test_report.md", lines: "Lines 1-34", score: 98 }
      ],
      suggestedFollowUps: [
        "What is the most critical vulnerability?",
        "Summarize all findings",
        "How to fix the high risk vulnerability?"
      ],
      modelUsed: getLlmConfig().model || 'Claude 3.5 Sonnet',
      timestamp: 'Just now'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCitationsFor, setShowCitationsFor] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setLlmConfig(getLlmConfig());
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await askLlmWithRag({
        userMessage: text,
        companyName,
        targetUrl,
        vulnerabilities,
        conversationHistory: messages
      });

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: response.text,
        bulletPoints: response.bulletPoints || [],
        citations: response.citations || [],
        suggestedFollowUps: response.suggestedFollowUps || [],
        modelUsed: response.modelUsed || llmConfig.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        text: `I encountered an issue generating a response: ${err.message}. Please check your LLM provider settings or try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: `Conversation cleared. I am ready to answer any questions about the security findings for **${companyName}**!`,
        suggestedFollowUps: [
          "What is the top security risk?",
          "Give me an executive summary",
          "What are the remediation steps?"
        ],
        timestamp: 'Just now'
      }
    ]);
  };

  const activeModelDisplay = llmConfig.model || 'Claude 3.5 Sonnet';

  return (
    <div className={`flex flex-col h-[calc(100vh-8rem)] rounded-2xl border shadow-xl overflow-hidden transition-colors ${
      theme === 'dark' ? 'bg-[#090E1A] border-slate-800' : 'bg-white border-slate-300'
    }`}>
      {/* Header Bar */}
      <div className={`p-4 border-b flex items-center justify-between gap-3 ${
        theme === 'dark' ? 'bg-[#0C1426] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-500 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className={`font-bold text-sm truncate flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-950'
            }`}>
              <span>AI Security Assistant</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono font-normal">
                RAG Grounded
              </span>
            </h2>
            <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
              Auditing <strong>{companyName}</strong> &bull; {activeModelDisplay}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenLlmSettings && (
            <button
              onClick={onOpenLlmSettings}
              title="Configure Any LLM Provider, API Key, Model Identifier, or Base URL"
              className={`h-8 px-2.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                theme === 'dark'
                  ? 'bg-[#080E1C] text-cyan-300 border-slate-700 hover:bg-slate-800 hover:border-cyan-500'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 hover:border-cyan-500 shadow-sm'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <span className="hidden sm:inline text-[11px] font-bold">Configure LLM</span>
            </button>
          )}

          <button
            onClick={handleResetChat}
            title="Reset Conversation"
            className={`h-8 px-2 rounded-lg text-xs font-mono transition-colors flex items-center gap-1 ${
              theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Clear</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 ${
        theme === 'dark' ? 'bg-[#070B14]' : 'bg-slate-50/50'
      }`}>
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-500 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm space-y-2 shadow-sm ${
                isUser
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                  : theme === 'dark'
                  ? 'bg-[#0E172B] border border-slate-800 text-slate-200 rounded-tl-none'
                  : 'bg-white border border-slate-300 text-slate-900 rounded-tl-none shadow-sm'
              }`}>
                {/* Main Text */}
                <div className="leading-relaxed whitespace-pre-line font-sans">
                  {msg.text}
                </div>

                {/* Bullet Points */}
                {msg.bulletPoints && msg.bulletPoints.length > 0 && (
                  <div className={`space-y-1.5 pt-2 ${
                    isUser ? 'border-t border-cyan-400/40' : theme === 'dark' ? 'border-t border-slate-800/80' : 'border-t border-slate-200'
                  }`}>
                    {msg.bulletPoints.map((pt, idx) => (
                      <div key={idx} className="leading-relaxed">
                        {pt}
                      </div>
                    ))}
                  </div>
                )}

                {/* RAG Citations */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className={`pt-2 border-t ${theme === 'dark' ? 'border-slate-800/60' : 'border-slate-200'}`}>
                    <button
                      onClick={() => setShowCitationsFor(showCitationsFor === msg.id ? null : msg.id)}
                      className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      <Layers className="w-3 h-3" />
                      <span>{showCitationsFor === msg.id ? 'Hide Citations' : `View ${msg.citations.length} Grounded Sources`}</span>
                    </button>

                    {showCitationsFor === msg.id && (
                      <div className={`mt-2 space-y-1 p-2.5 rounded-lg border text-[10px] font-mono ${
                        theme === 'dark' ? 'bg-[#070D1A] border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
                      }`}>
                        {msg.citations.map((c, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between">
                            <span>📄 {c.title} ({c.source})</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{c.score}% Match</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp & Model Badge */}
                <div className={`flex items-center justify-between text-[10px] font-mono pt-1 ${
                  isUser ? 'text-cyan-100/70' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>{msg.modelUsed ? `Model: ${msg.modelUsed}` : ''}</span>
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-500 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
              theme === 'dark' ? 'bg-[#0E172B] text-cyan-300 border border-slate-800' : 'bg-white text-cyan-800 border border-slate-300 shadow-sm'
            }`}>
              <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-500" />
              <span>Querying {activeModelDisplay} with grounded findings for {companyName}...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-ups */}
      {messages[messages.length - 1]?.suggestedFollowUps && (
        <div className={`px-4 py-2 flex flex-wrap items-center gap-2 text-xs border-t ${
          theme === 'dark' ? 'bg-[#0A101D] border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <span className={`text-[10px] font-mono font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Suggested:</span>
          {messages[messages.length - 1].suggestedFollowUps.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-sans transition-all ${
                theme === 'dark'
                  ? 'bg-[#111C33] hover:bg-[#1A2C52] text-cyan-300 border border-cyan-900/60'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-sm font-medium'
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className={`p-4 border-t ${
        theme === 'dark' ? 'bg-[#090E1A] border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask any question about ${companyName} security findings, impact, or fixes...`}
            className={`flex-1 px-4 h-11 rounded-xl text-xs sm:text-sm focus:outline-none transition-all font-sans ${
              theme === 'dark'
                ? 'bg-[#070B14] border border-slate-800 text-white placeholder-slate-500 focus:border-cyan-400'
                : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600'
            }`}
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold disabled:opacity-40 transition-all shadow-md flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
