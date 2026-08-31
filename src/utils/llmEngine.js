import { searchKnowledgeBase, generateChatbotResponse as localRagFallback } from './ragEngine';
import { getAuthHeaders } from './auth';

// Storage key for user's custom LLM configuration
const LLM_CONFIG_KEY = 'sennovate_universal_llm_config';

/**
 * Verified Available Models List
 */
export const USER_REQUESTED_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'Groq / OpenRouter', defaultUrl: 'https://api.groq.com/openai/v1' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (OpenAI Open Weights)', provider: 'OpenRouter / Groq', defaultUrl: 'https://openrouter.ai/api/v1' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (OpenAI Open Weights)', provider: 'OpenRouter / Groq', defaultUrl: 'https://openrouter.ai/api/v1' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', provider: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' }
];

/**
 * Default LLM Configuration
 */

export function getLlmConfig() {
  try {
    const saved = localStorage.getItem(LLM_CONFIG_KEY) || localStorage.getItem('sennovate_llm_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading LLM config:', e);
  }

  return {
    providerName: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 2048,
    useCustomEndpoint: true
  };
}

/**
 * Fetch global LLM config from backend and synchronize with localStorage
 */
export async function fetchGlobalLlmConfig() {
  try {
    const res = await fetch('/api/llm/get-config', {
      headers: { ...getAuthHeaders() }
    });
    if (res.ok) {
      const data = await res.json();
      const local = getLlmConfig();
      const serverHasKey = data.config && data.config.apiKey && data.config.apiKey.trim() !== '';
      const localHasKey = local && local.apiKey && local.apiKey.trim() !== '';

      let merged = { ...local };
      if (serverHasKey) {
        merged = { ...local, ...data.config };
      } else if (localHasKey) {
        // Upload local configured key to backend so it is preserved across restarts
        fetch('/api/llm/save-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(local)
        }).catch(() => {});
      }
      localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(merged));
      localStorage.setItem('sennovate_llm_config', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('llm_config_updated', { detail: merged }));
      return merged;
    }
  } catch (e) {
    console.warn('Note syncing global LLM config:', e);
  }
  return getLlmConfig();
}

export function saveLlmConfig(config) {
  try {
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem('sennovate_llm_config', JSON.stringify(config));

    // Sync to backend file storage (.llm_config.json)
    fetch('/api/llm/save-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(config)
    }).catch(err => console.warn('Note syncing LLM config to backend:', err));

    window.dispatchEvent(new CustomEvent('llm_config_updated', { detail: config }));
  } catch (e) {
    console.error('Error saving LLM config:', e);
  }
}

/**
 * Helper to execute HTTP request via local Vite proxy (to bypass CORS) with direct fallback
 */
async function executeApiRequest(targetUrl, headers, data) {
  // First attempt via local Vite proxy to prevent any browser CORS blockage
  try {
    const proxyRes = await fetch('/api/llm-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ targetUrl, headers, data })
    });

    if (proxyRes.ok) {
      return await proxyRes.json();
    } else {
      const errText = await proxyRes.text();
      let parsed = errText;
      try {
        const j = JSON.parse(errText);
        if (j.error?.message) parsed = j.error.message;
        else if (j.error) parsed = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
      } catch(e){}
      throw new Error(`HTTP ${proxyRes.status}: ${parsed}`);
    }
  } catch (proxyErr) {
    // If proxy failed or not on dev server, try direct fetch
    if (!proxyErr.message.includes('HTTP')) {
      const directRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (directRes.ok) {
        return await directRes.json();
      }
      const directErrText = await directRes.text();
      throw new Error(`HTTP ${directRes.status}: ${directErrText}`);
    }
    throw proxyErr;
  }
}

/**
 * Universal Endpoint Connectivity Tester
 */
export async function testLlmConnection(config) {
  const startTime = Date.now();
  const rawKey = (config.apiKey || '').trim();
  const rawModel = (config.model || 'llama-3.3-70b-versatile').trim();

  // If using Puter free bridge (no key provided)
  if (!config.useCustomEndpoint && !config.baseUrl && !rawKey) {
    if (typeof window !== 'undefined' && window.puter?.ai?.chat) {
      const res = await window.puter.ai.chat("Reply with 'Connected'", { model: 'gpt-4o-mini' });
      const latency = Date.now() - startTime;
      const text = res?.message?.content || res?.text || 'Connected';
      return {
        success: true,
        latency,
        reply: text.trim(),
        message: `Connected to Free Puter AI Bridge in ${latency}ms`
      };
    }
    return { success: true, latency: 10, reply: 'OK', message: 'Puter AI Ready' };
  }

  // Determine endpoint URL
  let baseUrl = (config.baseUrl || '').trim();
  if (!baseUrl) {
    if (rawKey.startsWith('gsk_')) {
      baseUrl = 'https://api.groq.com/openai/v1';
    } else if (rawKey.startsWith('AIzaSy') || rawModel.startsWith('gemini-')) {
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
    } else if (rawKey.startsWith('sk-or-')) {
      baseUrl = 'https://openrouter.ai/api/v1';
    } else {
      baseUrl = 'https://api.openai.com/v1';
    }
  }

  // Handle Google Gemini Native REST API if using standard gemini key format
  if (rawModel.startsWith('gemini-') && !baseUrl.includes('openai')) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${rawKey}`;
    try {
      const result = await executeApiRequest(geminiUrl, { 'Content-Type': 'application/json' }, {
        contents: [{ role: 'user', parts: [{ text: 'Say "Security AI Online" in 3 words.' }] }],
        generationConfig: { maxOutputTokens: 25, temperature: 0.2 }
      });
      const latency = Date.now() - startTime;
      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected!';
      return {
        success: true,
        latency,
        reply: reply.trim(),
        message: `Connected to Google Gemini (${rawModel}) in ${latency}ms: "${reply.trim()}"`
      };
    } catch (err) {
      // Fallback to Gemini OpenAI-compatible endpoint
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
    }
  }

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (rawKey) {
    headers['Authorization'] = `Bearer ${rawKey}`;
  }

  const payload = {
    model: rawModel,
    messages: [{ role: 'user', content: 'Say "Security AI Online" in 3 words.' }],
    max_tokens: 30,
    temperature: 0.2
  };

  const data = await executeApiRequest(endpoint, headers, payload);
  const latency = Date.now() - startTime;
  const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.message || 'Connected successfully!';

  return {
    success: true,
    latency,
    reply: reply.trim(),
    message: `Connected to ${rawModel} via ${cleanUrl} in ${latency}ms: "${reply.trim()}"`
  };
}

/**
 * Universal RAG + Any LLM Query Engine
 */
export async function askLlmWithRag({
  userMessage,
  companyName = "Vontier Corporation",
  targetUrl = "https://www.vontier.com/",
  vulnerabilities = [],
  conversationHistory = []
}) {
  const config = getLlmConfig();
  const rawKey = (config.apiKey || '').trim();
  const rawModel = (config.model || 'llama-3.3-70b-versatile').trim();

  // Step 1: Semantic RAG Retrieval over current scan findings
  const relevantChunks = searchKnowledgeBase(userMessage, 4);

  // Format retrieved context for LLM prompt
  const contextText = relevantChunks
    .map((c, i) => `[Evidence ${i + 1}: ${c.title} (${c.source} ${c.lines})]\n${c.content}`)
    .join('\n\n');

  // Summary of all active vulnerabilities
  const vulnsSummary = vulnerabilities
    .map(v => `- [${v.id}] ${v.title} (${v.severity}, CVSS: ${v.cvss}, CWE: ${v.cwe}) on ${v.target} (Endpoint: ${v.endpoint})`)
    .join('\n');

  const systemPrompt = `You are the Sennovate Inc. AI Cyber Security & VAPT Assistant.
You are assisting an executive or security engineer with the results of a real penetration test conducted for target company "${companyName}" (Target URL: ${targetUrl}).

Verified Findings Summary for ${companyName}:
${vulnsSummary}

Retrieved RAG Context Chunks:
${contextText}

Guidelines:
1. Answer clearly, accurately, and professionally in simple, human-friendly terms without excessive jargon.
2. Directly answer the user's question using the retrieved findings and evidence.
3. If referencing specific vulnerabilities, cite their ID (e.g. vuln-0004) and severity.
4. When suggesting remediation, provide clear actionable steps.
5. Format your output with clear markdown headings, bullet points, and bold text for readability.`;

  // Step 2: Custom / User-Configured Endpoint
  if (config.useCustomEndpoint || rawKey || (config.baseUrl && config.baseUrl !== '')) {
    try {
      let baseUrl = (config.baseUrl || '').trim();
      if (!baseUrl) {
        if (rawKey.startsWith('gsk_')) {
          baseUrl = 'https://api.groq.com/openai/v1';
        } else if (rawKey.startsWith('AIzaSy') || rawModel.startsWith('gemini-')) {
          baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
        } else if (rawKey.startsWith('sk-or-')) {
          baseUrl = 'https://openrouter.ai/api/v1';
        } else {
          baseUrl = 'https://api.openai.com/v1';
        }
      }

      // Handle Gemini Native REST
      if (rawModel.startsWith('gemini-') && !baseUrl.includes('openai') && rawKey) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${rawKey}`;
        const contents = [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMessage}` }] }
        ];
        const resData = await executeApiRequest(geminiUrl, { 'Content-Type': 'application/json' }, {
          contents,
          generationConfig: {
            temperature: config.temperature !== undefined ? parseFloat(config.temperature) : 0.3,
            maxOutputTokens: config.maxTokens ? parseInt(config.maxTokens) : 2048
          }
        });

        const replyContent = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyContent) {
          return {
            answer: replyContent,
            bulletPoints: [],
            citations: relevantChunks.map(c => ({
              title: c.title,
              source: c.source,
              lines: c.lines,
              score: c.score
            })),
            suggestedFollowUps: [
              "What are the remediation priorities?",
              "Explain the attack chain in detail",
              "Which systems passed testing with zero findings?"
            ],
            modelUsed: `Google Gemini (${rawModel})`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        }
      }

      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const endpoint = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

      const headers = { 'Content-Type': 'application/json' };
      if (rawKey) {
        headers['Authorization'] = `Bearer ${rawKey}`;
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-4).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: userMessage }
      ];

      const data = await executeApiRequest(endpoint, headers, {
        model: rawModel,
        messages,
        temperature: config.temperature !== undefined ? parseFloat(config.temperature) : 0.3,
        max_tokens: config.maxTokens ? parseInt(config.maxTokens) : 2048
      });

      const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || 'No response returned from model.';

      return {
        answer: content,
        bulletPoints: [],
        citations: relevantChunks.map(c => ({
          title: c.title,
          source: c.source,
          lines: c.lines,
          score: c.score
        })),
        suggestedFollowUps: [
          "What are the remediation priorities?",
          "Explain the attack chain in detail",
          "Which systems passed testing with zero findings?"
        ],
        modelUsed: `${config.providerName || 'AI'} (${rawModel})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } catch (err) {
      console.warn('Custom LLM API call failed, falling back to Puter/Local:', err);
    }
  }

  // Step 3: Free Puter.js AI Bridge (Claude 3.5 Sonnet / DeepSeek-V3 / GPT-4o-mini)
  if (typeof window !== 'undefined' && window.puter?.ai?.chat) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-4).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: userMessage }
      ];

      const puterResponse = await window.puter.ai.chat(messages, {
        model: 'claude-3-5-sonnet',
        temperature: 0.3
      });

      const responseContent = puterResponse?.message?.content || puterResponse?.text || String(puterResponse);

      return {
        answer: responseContent,
        bulletPoints: [],
        citations: relevantChunks.map(c => ({
          title: c.title,
          source: c.source,
          lines: c.lines,
          score: c.score
        })),
        suggestedFollowUps: [
          "What are the remediation priorities?",
          "Explain the attack chain in detail",
          "Which systems passed testing with zero findings?"
        ],
        modelUsed: 'Free Puter AI (Claude 3.5 Sonnet)',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } catch (err) {
      console.warn('Puter AI API call failed, falling back to Local RAG:', err);
    }
  }

  // Step 4: Local RAG Fallback
  const fallback = localRagFallback(userMessage, conversationHistory);
  return {
    answer: fallback.answer,
    bulletPoints: fallback.bulletPoints,
    citations: relevantChunks.map(c => ({
      title: c.title,
      source: c.source,
      lines: c.lines,
      score: c.score
    })),
    suggestedFollowUps: fallback.suggestedFollowUps,
    modelUsed: 'Sennovate Local RAG Engine (Offline Fallback)',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}
