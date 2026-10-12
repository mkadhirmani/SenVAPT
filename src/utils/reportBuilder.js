/**
 * Sennovate VAPT Report Builder
 * ---------------------------------------------------------------------------
 * Produces ONE self-contained HTML document that is used for:
 *   - the in-app A4 preview (iframe),
 *   - the downloadable PDF (server-side headless Chrome, vector text),
 *   - the browser print fallback and the editable .html export.
 *
 * Styling follows the Sennovate Product Skill (sennovate skill/):
 *   [OFFICIAL BRAND RULE]  Sennovate Blue #006FE3, Dark Blue #001B41, White,
 *                          supporting Green #299346 / Purple #3C2C86 /
 *                          Terra Cotta #B9623C, Satoshi headings, Inter body,
 *                          official logo with 1X clear space.
 *   [PRODUCT UI STANDARD]  4px spacing grid, neutral surfaces, table anatomy.
 *   TO BE DEFINED          Severity colour scale is not defined in the brand
 *                          guidelines; a local product exception is used
 *                          (Critical = status-danger, High = Terra Cotta,
 *                          Medium = amber, Low = Sennovate Blue, Info = slate).
 *
 * All scan data is HTML-escaped (findings routinely contain XSS payloads).
 */
import { sortVulnerabilities, normalizeSeverity, computeOverallRisk, getFindingCvss } from './severityUtils';
import { paginateReport } from './reportPaginator';
import logoDarkSvg from '../assets/brand/sennovate-logo-dark.svg?raw';
import logoWhiteSvg from '../assets/brand/sennovate-logo-white.svg?raw';

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */
export function esc(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function str(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join('\n');
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/** Inline markdown-lite on already-escaped text: **bold**, `code`. */
function inlineMd(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const LIST_RE = /^\s*(?:(\d+)[.)]|[-*•])\s+(.*)$/;

/**
 * Converts free text from the scanner into clean paragraphs and lists.
 * Consecutive "1. / - / *" lines become lists, other lines paragraphs.
 */
function richText(value, { allowHeadings = false } = {}) {
  const text = str(value).replace(/\r\n/g, '\n');
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let para = [];
  let list = null; // { ordered, items, start }
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(l => inlineMd(esc(l.trim()))).join('<br>')}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      const start = list.ordered && list.start > 1 ? ` start="${list.start}"` : '';
      out.push(`<${tag}${start}>${list.items.map(i => `<li>${inlineMd(esc(i))}</li>`).join('')}</${tag}>`);
      list = null;
    }
  };
  lines.forEach(raw => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); flushList(); return; }
    if (allowHeadings && /^#{1,4}\s+/.test(line)) {
      flushPara(); flushList();
      out.push(`<h4 class="kwn">${inlineMd(esc(line.replace(/^#{1,4}\s+/, '')))}</h4>`);
      return;
    }
    const m = line.match(LIST_RE);
    if (m) {
      flushPara();
      const ordered = !!m[1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [], start: ordered ? parseInt(m[1], 10) : 1 };
      }
      list.items.push(m[2]);
      return;
    }
    // indented continuation of the previous list item
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
      return;
    }
    flushList();
    para.push(line);
  });
  flushPara();
  flushList();
  return out.join('\n');
}

function codeBlock(code, caption) {
  const c = str(code);
  if (!c) return '';
  return `${caption ? `<div class="code-cap kwn">${esc(caption)}</div>` : ''}<pre class="code">${esc(c)}</pre>`;
}

function cleanTitle(t) {
  return str(t).replace(/^#+\s*/, '').replace(/\*\*/g, '');
}

export function getCompleteTargetUrl(vuln, fallbackBaseUrl) {
  if (!vuln) return fallbackBaseUrl || '';
  const targetStr = str(vuln.target);
  const endpointStr = str(vuln.endpoint);
  if (targetStr && /^https?:\/\//i.test(targetStr)) {
    if (endpointStr && endpointStr.startsWith('/') && !targetStr.endsWith(endpointStr)) {
      try { return `${new URL(targetStr).origin}${endpointStr}`; } catch (e) { return targetStr; }
    }
    return targetStr;
  }
  const base = fallbackBaseUrl && /^https?:\/\//i.test(fallbackBaseUrl)
    ? fallbackBaseUrl
    : (fallbackBaseUrl ? `https://${fallbackBaseUrl}` : '');
  const path = endpointStr || targetStr || '/';
  if (!base) return path;
  try {
    const u = new URL(base);
    return `${u.origin}${path.startsWith('/') ? path : `/${path}`}`;
  } catch (e) {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}

function hostOf(u) {
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname; } catch (e) { return ''; }
}

function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(String(d).replace(' UTC', 'Z').replace(' ', 'T'));
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

const SEV = {
  CRITICAL: { label: 'Critical', cls: 'crit', range: '9.0 – 10.0', sla: 'Within 24–72 hours', desc: 'Directly exploitable; leads to full compromise of systems or sensitive data.' },
  HIGH: { label: 'High', cls: 'high', range: '7.0 – 8.9', sla: 'Within 7 days', desc: 'Significant impact; exploitation is likely and may lead to data exposure or privilege escalation.' },
  MEDIUM: { label: 'Medium', cls: 'med', range: '4.0 – 6.9', sla: 'Within 30 days', desc: 'Moderate impact or requires specific conditions; should be fixed in the next release cycle.' },
  LOW: { label: 'Low', cls: 'low', range: '0.1 – 3.9', sla: 'Within 90 days', desc: 'Limited impact; hardening or best-practice improvement.' },
  INFO: { label: 'Informational', cls: 'info', range: '0.0', sla: 'As appropriate', desc: 'No direct risk; observation that supports defence-in-depth.' },
  NONE: { label: 'None', cls: 'info', range: '0.0', sla: '—', desc: '' }
};
const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function sevPill(sev) {
  const s = SEV[normalizeSeverity(sev)] || SEV.INFO;
  return `<span class="pill sev-${s.cls}">${esc(s.label)}</span>`;
}

function shortCwe(cwe) {
  const c = str(cwe);
  if (!c) return '—';
  const m = c.match(/CWE-\d+/i);
  return m ? m[0].toUpperCase() : c.split(/[:\s]/)[0];
}

/* ------------------------------------------------------------------------ */
/* Stylesheet                                                               */
/* ------------------------------------------------------------------------ */
const REPORT_CSS = `
:root{
  --sennovate-blue:#006FE3; --sennovate-blue-70:#4D9AEC; --sennovate-blue-30:#B3D4F7; --sennovate-blue-10:#E6F1FC;
  --sennovate-dark-blue:#001B41; --sennovate-white:#FFFFFF;
  --sennovate-support-green:#299346; --sennovate-support-purple:#3C2C86; --sennovate-support-terracotta:#B9623C;
  --color-bg-canvas:#F8FAFC; --color-border-subtle:#E2E8F0; --color-border-strong:#CBD5E1;
  --color-text-primary:#001B41; --color-text-secondary:#4A5568; --color-text-muted:#64748B;
  --sev-crit:#DC2626; --sev-crit-bg:#FEF2F2;
  --sev-high:#B9623C; --sev-high-bg:#FBF0EA;
  --sev-med:#B7791F; --sev-med-bg:#FFFBEB;
  --sev-low:#006FE3; --sev-low-bg:#EFF6FF;
  --sev-info:#64748B; --sev-info-bg:#F1F5F9;
  --font-display:'Satoshi','Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --font-body:'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --font-mono:'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace;
}
@page{ size:A4 portrait; margin:0; }
*,*::before,*::after{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html,body{ margin:0; padding:0; }
body{ background:#E9EDF3; color:var(--color-text-primary); font-family:var(--font-body); font-size:9.5pt; line-height:1.55; -webkit-font-smoothing:antialiased; }
#report-book{ display:flex; flex-direction:column; align-items:center; gap:16px; padding:24px 0; }
.page{ width:210mm; height:297mm; background:#fff; position:relative; overflow:hidden; box-shadow:0 4px 18px rgba(0,27,65,.12); display:flex; flex-direction:column; }
.page.overflowing{ overflow:visible; }
@media print{
  body{ background:#fff; }
  #report-book{ display:block; padding:0; gap:0; }
  .page{ box-shadow:none; break-after:page; page-break-after:always; margin:0; }
  .page:last-child{ break-after:auto; page-break-after:auto; }
}
/* running header / footer */
.page-head{ height:20mm; flex:0 0 20mm; padding:8mm 18mm 0; display:flex; align-items:flex-start; justify-content:space-between; }
.page-head .logo svg{ height:5.2mm; width:auto; display:block; }
.page-head .meta{ text-align:right; font-size:7.5pt; color:var(--color-text-muted); line-height:1.35; }
.page-head .meta b{ color:var(--sennovate-dark-blue); font-weight:600; }
.page-head-rule{ position:absolute; left:18mm; right:18mm; top:17mm; height:0; border-top:1px solid var(--color-border-subtle); }
.page-body{ flex:1 1 auto; padding:2mm 18mm 0; overflow:hidden; }
.page.overflowing .page-body{ overflow:visible; }
.page-content{ display:flow-root; }
.page-content > :first-child{ margin-top:0 !important; }
.page-foot{ height:16mm; flex:0 0 16mm; margin:0 18mm; display:flex; align-items:center; justify-content:space-between; font-size:7.5pt; color:var(--color-text-muted); border-top:1px solid var(--color-border-subtle); }
.page-foot .conf{ font-weight:600; color:var(--sennovate-dark-blue); letter-spacing:.06em; text-transform:uppercase; }
.page-foot .pgn b{ color:var(--sennovate-dark-blue); }

/* typography */
h1,h2,h3,h4{ font-family:var(--font-display); color:var(--sennovate-dark-blue); margin:0; letter-spacing:-.01em; }
h2.section{ font-size:18pt; font-weight:700; margin:0 0 4mm; padding-top:1mm; display:flex; align-items:baseline; gap:3mm; }
h2.section .num{ color:var(--sennovate-blue); }
h2.section + .section-rule{ height:1mm; width:16mm; background:var(--sennovate-blue); margin:-2mm 0 5mm; border-radius:1mm; }
h3{ font-size:12pt; font-weight:700; margin:6mm 0 2.5mm; }
h4{ font-size:10pt; font-weight:700; margin:4.5mm 0 1.5mm; color:var(--sennovate-dark-blue); }
p{ margin:0 0 2.5mm; color:#1F2A44; orphans:2; widows:2; }
p.lead{ font-size:10.5pt; color:var(--color-text-secondary); }
ul,ol{ margin:0 0 3mm; padding-left:6mm; color:#1F2A44; }
li{ margin:0 0 1.2mm; padding-left:1mm; }
li.cont{ list-style:none; }
strong{ font-weight:600; color:var(--sennovate-dark-blue); }
code{ font-family:var(--font-mono); font-size:8.2pt; background:var(--sennovate-blue-10); color:#003A78; padding:0 1mm; border-radius:1mm; word-break:break-word; }
.muted{ color:var(--color-text-muted); }
.small{ font-size:8pt; }
.eyebrow{ font-size:7.5pt; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--sennovate-blue); margin-bottom:1.5mm; }

/* code / evidence */
.code-cap{ font-size:7.5pt; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--color-text-muted); margin:3mm 0 1mm; }
pre.code{ font-family:var(--font-mono); font-size:7.6pt; line-height:1.5; background:#F4F7FB; color:#0B2545; border:1px solid var(--color-border-subtle); border-left:3px solid var(--sennovate-blue); border-radius:1.5mm; padding:3mm 3.5mm; margin:0 0 3mm; white-space:pre-wrap; word-break:break-all; overflow-wrap:anywhere; }
pre.code.cont{ border-top-left-radius:0; border-top-right-radius:0; }

/* tables */
table{ width:100%; border-collapse:collapse; margin:0 0 4mm; font-size:8.5pt; }
thead th{ background:var(--sennovate-dark-blue); color:#fff; font-family:var(--font-body); font-weight:600; font-size:7.5pt; letter-spacing:.06em; text-transform:uppercase; text-align:left; padding:2.2mm 2.5mm; }
tbody td{ padding:2mm 2.5mm; border-bottom:1px solid var(--color-border-subtle); vertical-align:top; color:#1F2A44; }
tbody tr:nth-child(even) td{ background:#FAFBFD; }
td.num,th.num{ text-align:right; white-space:nowrap; }
td.nw{ white-space:nowrap; }
td.mono{ font-family:var(--font-mono); font-size:7.8pt; word-break:break-all; }
table.kv{ border:1px solid var(--color-border-subtle); }
table.kv td{ background:#fff !important; }
table.kv4 td.k{ width:17%; }
table.kv td.k{ width:30%; background:var(--color-bg-canvas) !important; font-weight:600; color:var(--sennovate-dark-blue); font-size:8pt; }

/* pills */
.pill{ display:inline-block; font-size:7.2pt; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:.6mm 2.2mm; border-radius:10mm; border:1px solid transparent; white-space:nowrap; line-height:1.4; }
.sev-crit{ color:var(--sev-crit); background:var(--sev-crit-bg); border-color:#F5C2C2; }
.sev-high{ color:var(--sev-high); background:var(--sev-high-bg); border-color:#EBCDBE; }
.sev-med{ color:var(--sev-med); background:var(--sev-med-bg); border-color:#F2DFAE; }
.sev-low{ color:var(--sev-low); background:var(--sev-low-bg); border-color:var(--sennovate-blue-30); }
.sev-info{ color:var(--sev-info); background:var(--sev-info-bg); border-color:#D7DEE8; }
.bg-crit{ background:var(--sev-crit); } .bg-high{ background:var(--sev-high); } .bg-med{ background:var(--sev-med); } .bg-low{ background:var(--sev-low); } .bg-info{ background:var(--sev-info); }

/* cards / panels */
.card{ border:1px solid var(--color-border-subtle); border-radius:2.5mm; padding:4mm 4.5mm; margin:0 0 4mm; background:#fff; }
.card.tint{ background:var(--color-bg-canvas); }
.callout{ border-left:3px solid var(--sennovate-blue); background:var(--sennovate-blue-10); padding:3mm 4mm; border-radius:0 2mm 2mm 0; margin:0 0 4mm; }
.callout.warn{ border-left-color:var(--sennovate-support-terracotta); background:#FBF0EA; }
.callout p:last-child{ margin-bottom:0; }

/* risk overview */
.risk-grid{ display:grid; grid-template-columns:62mm 1fr; gap:5mm; margin:0 0 5mm; }
.score-card{ background:var(--sennovate-dark-blue); color:#fff; border-radius:3mm; padding:5mm; }
.score-card .lab{ font-size:7.5pt; letter-spacing:.12em; text-transform:uppercase; color:var(--sennovate-blue-30); font-weight:600; }
.score-card .val{ font-family:var(--font-display); font-size:34pt; font-weight:700; line-height:1.05; margin-top:2mm; }
.score-card .val small{ font-size:11pt; font-weight:500; color:var(--sennovate-blue-30); }
.score-card .lvl{ display:inline-block; margin-top:2mm; font-size:8pt; font-weight:700; letter-spacing:.08em; padding:.8mm 2.5mm; border-radius:10mm; background:#fff; }
.score-card .lvl.crit{ color:var(--sev-crit); } .score-card .lvl.high{ color:var(--sev-high); } .score-card .lvl.med{ color:var(--sev-med); } .score-card .lvl.low{ color:var(--sev-low); } .score-card .lvl.info{ color:var(--sev-info); }
.score-card .scale{ margin-top:4mm; }
.score-card .note{ margin-top:3mm; font-size:7.2pt; line-height:1.45; color:#B9C6D8; }
.dist{ border:1px solid var(--color-border-subtle); border-radius:3mm; padding:4mm 4.5mm; }
.dist .ttl{ font-family:var(--font-display); font-weight:700; font-size:10pt; margin-bottom:3mm; }
.dist-row{ display:grid; grid-template-columns:24mm 1fr 10mm; align-items:center; gap:3mm; margin:0 0 2.4mm; font-size:8.5pt; }
.dist-row .bar{ height:3.2mm; background:#EEF2F7; border-radius:2mm; overflow:hidden; }
.dist-row .bar > span{ display:block; height:100%; border-radius:2mm; }
.dist-row .n{ text-align:right; font-weight:700; font-family:var(--font-display); }
.dist .foot{ display:flex; justify-content:space-between; border-top:1px solid var(--color-border-subtle); padding-top:2.5mm; margin-top:3mm; font-size:8pt; color:var(--color-text-secondary); }
.dist .foot b{ color:var(--sennovate-dark-blue); }

.kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; margin:0 0 5mm; }
.kpi{ border:1px solid var(--color-border-subtle); border-radius:2.5mm; padding:3mm 3.5mm; }
.kpi .l{ font-size:7pt; letter-spacing:.08em; text-transform:uppercase; color:var(--color-text-muted); font-weight:600; }
.kpi .v{ font-family:var(--font-display); font-size:15pt; font-weight:700; color:var(--sennovate-dark-blue); line-height:1.2; margin-top:1mm; }

.phases{ display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; margin:0 0 4mm; }
.phase{ border:1px solid var(--color-border-subtle); border-top:3px solid var(--sennovate-blue); border-radius:2mm; padding:3mm; font-size:8pt; color:var(--color-text-secondary); }
.phase b{ display:block; font-family:var(--font-display); font-size:9pt; color:var(--sennovate-dark-blue); margin-bottom:1mm; }
.phase .n{ font-size:7pt; color:var(--sennovate-blue); font-weight:700; letter-spacing:.08em; }

.roadmap{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; margin:0 0 4mm; }
.rm{ border-radius:2.5mm; padding:3.5mm; font-size:8.3pt; border:1px solid var(--color-border-subtle); }
.rm .w{ font-size:7pt; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.rm b{ display:block; font-family:var(--font-display); font-size:10pt; color:var(--sennovate-dark-blue); margin:1mm 0; }
.rm.r1 .w{ color:var(--sev-crit); } .rm.r2 .w{ color:var(--sev-high); } .rm.r3 .w{ color:var(--sennovate-blue); }
.rm p{ margin:0; font-size:8.2pt; color:var(--color-text-secondary); }

/* TOC */
.toc{ margin:0 0 6mm; }
.toc-row{ display:flex; align-items:baseline; gap:2mm; padding:2mm 0; border-bottom:1px dotted var(--color-border-strong); font-size:9.5pt; }
.toc-row .t{ flex:1; }
.toc-row.sub{ padding-left:7mm; font-size:8.8pt; color:var(--color-text-secondary); }
.toc-row .p{ font-weight:600; min-width:8mm; text-align:right; color:var(--sennovate-dark-blue); }
.toc-row .n{ color:var(--sennovate-blue); font-weight:700; min-width:7mm; }

/* findings */
.finding-head{ border:1px solid var(--color-border-subtle); border-radius:2.5mm; overflow:hidden; margin:2mm 0 3mm; }
.finding-head .bar{ height:1.4mm; }
.finding-head .inner{ padding:3.5mm 4mm; display:flex; gap:4mm; align-items:flex-start; justify-content:space-between; }
.finding-head .ref{ font-size:7.5pt; font-weight:700; letter-spacing:.08em; color:var(--sennovate-blue); text-transform:uppercase; }
.finding-head .title{ font-family:var(--font-display); font-size:12.5pt; font-weight:700; color:var(--sennovate-dark-blue); line-height:1.3; margin-top:.8mm; }
.finding-head .score{ text-align:right; flex:0 0 auto; }
.finding-head .score .cv{ font-family:var(--font-display); font-weight:700; font-size:16pt; color:var(--sennovate-dark-blue); line-height:1.1; margin-top:1.2mm; }
.finding-head .score .cv small{ font-size:7pt; color:var(--color-text-muted); font-weight:600; letter-spacing:.06em; display:block; }
.finding + .finding{ margin-top:7mm; }
.finding h4{ display:flex; align-items:center; gap:2mm; }
.finding h4::before{ content:''; width:1.2mm; height:3.6mm; background:var(--sennovate-blue); border-radius:.6mm; display:inline-block; }

/* cover */
.cover{ height:297mm; display:flex; flex-direction:column; }
.cover-top{ background:var(--sennovate-dark-blue); color:#fff; flex:0 0 172mm; padding:22mm 20mm 14mm; position:relative; overflow:hidden; display:flex; flex-direction:column; }
.cover-top .logo svg{ height:9mm; width:auto; display:block; }
.cover-top .grid-bg{ position:absolute; inset:0; opacity:.10; background-image:linear-gradient(to right,#4D9AEC 1px,transparent 1px),linear-gradient(to bottom,#4D9AEC 1px,transparent 1px); background-size:9mm 9mm; }
.cover-top .shield{ position:absolute; right:-18mm; bottom:-26mm; width:120mm; height:120mm; border-radius:50%; background:radial-gradient(circle at center, rgba(0,111,227,.45), rgba(0,111,227,0) 70%); }
.cover-top .content{ position:relative; margin-top:auto; }
.cover-top .kicker{ font-size:8.5pt; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:var(--sennovate-blue-30); }
.cover-top h1{ color:#fff; font-size:30pt; font-weight:700; line-height:1.12; margin:4mm 0 0; max-width:150mm; }
.cover-top .accent{ width:22mm; height:1.4mm; background:var(--sennovate-blue); border-radius:1mm; margin:7mm 0 6mm; }
.cover-top .client-lab{ font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--sennovate-blue-30); font-weight:600; }
.cover-top .client{ font-family:var(--font-display); font-size:20pt; font-weight:700; margin-top:1.5mm; line-height:1.2; word-break:break-word; }
.cover-top .domain{ font-family:var(--font-mono); font-size:9.5pt; color:#CFE2F9; margin-top:1.5mm; word-break:break-all; }
.cover-bottom{ flex:1; padding:12mm 20mm 0; display:flex; flex-direction:column; }
.cover-meta{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:6mm 6mm; }
.cover-meta .l{ font-size:7pt; letter-spacing:.1em; text-transform:uppercase; color:var(--color-text-muted); font-weight:600; }
.cover-meta .v{ font-size:9.5pt; color:var(--sennovate-dark-blue); font-weight:600; margin-top:1mm; word-break:break-word; }
.cover-risk{ margin-top:9mm; display:flex; align-items:center; gap:5mm; border:1px solid var(--color-border-subtle); border-radius:3mm; padding:4mm 5mm; }
.cover-risk .big{ font-family:var(--font-display); font-size:24pt; font-weight:700; color:var(--sennovate-dark-blue); line-height:1; }
.cover-risk .big small{ font-size:10pt; color:var(--color-text-muted); font-weight:500; }
.cover-risk .txt{ font-size:8.5pt; color:var(--color-text-secondary); flex:1; }
.cover-risk .txt b{ display:block; font-family:var(--font-display); font-size:10.5pt; color:var(--sennovate-dark-blue); margin-bottom:.6mm; }
.cover-foot{ margin-top:auto; padding:6mm 0 9mm; display:flex; justify-content:space-between; align-items:center; font-size:7.5pt; color:var(--color-text-muted); border-top:1px solid var(--color-border-subtle); }
.cover-foot .conf{ color:var(--sev-crit); font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
`;

/* ------------------------------------------------------------------------ */
/* Builder                                                                   */
/* ------------------------------------------------------------------------ */
export function buildReportHtml({
  vulnerabilities = [],
  metadata = {},
  companyName = 'Target Organization',
  targetDomain = '',
  targetUrl = '',
  reportType = 'detailed',
  executiveSummary = null,
  evaluatedTargets = [],
  generatedAt = new Date()
} = {}) {
  const vulns = sortVulnerabilities(vulnerabilities).map(v => ({ ...v, severity: normalizeSeverity(v.severity) }));
  const risk = computeOverallRisk(vulns);
  const detailed = reportType !== 'simple';
  const counts = risk.counts;
  const total = vulns.length;
  const reportDate = fmtDate(generatedAt);
  const startDate = fmtDate(metadata.startTime || metadata.timestamp);
  const endDate = fmtDate(metadata.endTime);
  const testWindow = startDate ? (endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate) : reportDate;
  const docRef = `SEN-VAPT-${(String(metadata.runId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'REPORT').toUpperCase()}`;
  const levelCls = (SEV[risk.level] || SEV.INFO).cls;
  const levelLabel = risk.level === 'NONE' ? 'No Risk Identified' : `${(SEV[risk.level] || SEV.INFO).label} Risk`;
  const title = 'Vulnerability Assessment &amp; Penetration Testing Report';
  const client = esc(companyName);
  const assessmentType = esc(metadata.assessmentType || 'External Web Application & API Penetration Test');
  const hosts = Array.from(new Set((evaluatedTargets || []).filter(Boolean)));

  /* ---- running header/footer template ---- */
  const pageTemplate = `
<template id="page-template">
  <section class="page">
    <div class="page-head">
      <div class="logo" aria-label="Sennovate">${logoDarkSvg}</div>
      <div class="meta"><b>${client}</b><br>VAPT Report &middot; ${esc(docRef)}</div>
    </div>
    <div class="page-head-rule"></div>
    <div class="page-body"><div class="page-content"></div></div>
    <div class="page-foot">
      <span class="conf">Confidential</span>
      <span>Sennovate Inc. &middot; www.sennovate.com</span>
      <span class="pgn">Page <b class="pg-num"></b> of <span class="pg-total"></span></span>
    </div>
  </section>
</template>`;

  /* ---- cover ---- */
  const cover = `
<section class="page cover-page">
  <div class="cover">
    <div class="cover-top">
      <div class="grid-bg"></div><div class="shield"></div>
      <div class="logo" style="position:relative" aria-label="Sennovate">${logoWhiteSvg}</div>
      <div class="content">
        <div class="kicker">Security Assessment Report</div>
        <h1>${title}</h1>
        <div class="accent"></div>
        <div class="client-lab">Prepared for</div>
        <div class="client">${client}</div>
        <div class="domain">${esc(targetDomain || hostOf(targetUrl) || targetUrl)}</div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cover-meta">
        <div><div class="l">Report Date</div><div class="v">${esc(reportDate)}</div></div>
        <div><div class="l">Testing Window</div><div class="v">${esc(testWindow)}</div></div>
        <div><div class="l">Document Reference</div><div class="v">${esc(docRef)}</div></div>
        <div><div class="l">Assessment Type</div><div class="v">${assessmentType}</div></div>
        <div><div class="l">Report Format</div><div class="v">${detailed ? 'Detailed Technical Report' : 'Summary Report'}</div></div>
        <div><div class="l">Prepared By</div><div class="v">Sennovate Inc.</div></div>
      </div>
      <div class="cover-risk">
        <div class="big">${risk.score.toFixed(1)}<small> / 10</small></div>
        <div class="txt"><b>Overall Risk: ${esc(levelLabel)}</b>${total} confirmed finding${total === 1 ? '' : 's'} &middot; ${ORDER.filter(k => counts[k]).map(k => `${counts[k]} ${SEV[k].label}`).join(' &middot; ') || 'none'}</div>
        <span class="pill sev-${levelCls}">${esc(risk.level === 'NONE' ? 'None' : SEV[risk.level].label)}</span>
      </div>
      <div class="cover-foot">
        <span class="conf">Confidential &amp; Proprietary</span>
        <span>Sennovate Inc. &middot; www.sennovate.com</span>
      </div>
    </div>
  </div>
</section>`;

  /* ---- flow content ---- */
  const parts = [];
  const tocEntries = [];
  const section = (id, num, name) => {
    tocEntries.push({ id, num, name, sub: false });
    return `<h2 class="section kwn" id="${id}"><span class="num">${num}</span>${esc(name)}</h2><div class="section-rule kwn nosplit"></div>`;
  };

  // Document control + TOC
  parts.push(`<h2 class="section kwn" id="sec-doc">Document Control</h2><div class="section-rule kwn nosplit"></div>`);
  parts.push(`<table class="kv"><tbody>
    <tr><td class="k">Document Title</td><td>${title}</td></tr>
    <tr><td class="k">Client</td><td>${client}</td></tr>
    <tr><td class="k">Primary Target</td><td class="mono">${esc(targetUrl)}</td></tr>
    <tr><td class="k">Document Reference</td><td>${esc(docRef)}</td></tr>
    <tr><td class="k">Version</td><td>1.0 &middot; Final</td></tr>
    <tr><td class="k">Report Date</td><td>${esc(reportDate)}</td></tr>
    <tr><td class="k">Classification</td><td><strong>Confidential</strong> &mdash; intended solely for ${client}</td></tr>
    <tr><td class="k">Prepared By</td><td>Sennovate Inc. &middot; ${esc(metadata.leadAuditor || 'Sennovate Autonomous VAPT Platform')}</td></tr>
  </tbody></table>`);
  parts.push(`<div class="eyebrow kwn" style="margin-top:7mm">Contents</div><div class="toc" id="toc-slot"></div>`);

  // 1. Executive summary
  const topFindings = vulns.slice(0, 5);
  const breakdownText = ORDER.filter(k => counts[k]).map(k => `${counts[k]} ${SEV[k].label.toLowerCase()}`).join(', ');
  parts.push(`<div data-break="page"></div>`);
  parts.push(section('sec-exec', '1', 'Executive Summary'));
  if (executiveSummary && str(executiveSummary)) {
    parts.push(richText(executiveSummary, { allowHeadings: true }));
  } else {
    parts.push(`<p class="lead">Sennovate performed ${assessmentType.toLowerCase().startsWith('external') ? 'an' : 'a'} ${assessmentType} of <strong>${client}</strong>, targeting <code>${esc(targetUrl)}</code>${hosts.length > 1 ? ` and ${hosts.length - 1} related host${hosts.length - 1 === 1 ? '' : 's'}` : ''}. The objective was to identify exploitable weaknesses in the externally reachable attack surface and to provide prioritised, actionable remediation guidance.</p>`);
    parts.push(`<p>The assessment confirmed <strong>${total} security finding${total === 1 ? '' : 's'}</strong>${breakdownText ? ` (${breakdownText})` : ''}. Taking every confirmed finding into account, the <strong>overall risk score is ${risk.score.toFixed(1)} out of 10</strong>, which corresponds to a <strong>${esc(levelLabel.toLowerCase())}</strong> posture. The most severe individual issue scored CVSS ${risk.maxCvss.toFixed(1)}${topFindings[0] ? ` (<em>${esc(cleanTitle(topFindings[0].title))}</em>)` : ''}.</p>`);
    if (counts.CRITICAL + counts.HIGH > 0) {
      parts.push(`<p>${counts.CRITICAL + counts.HIGH} finding${counts.CRITICAL + counts.HIGH === 1 ? '' : 's'} rated high or critical should be treated as a priority, as ${counts.CRITICAL + counts.HIGH === 1 ? 'it presents' : 'they present'} a realistic path to compromise of application data, user sessions or underlying infrastructure. Remaining issues are mainly configuration and hardening gaps that increase the likelihood or impact of an attack.</p>`);
    } else if (total > 0) {
      parts.push(`<p>No critical or high severity issues were confirmed. The findings mainly relate to configuration and hardening gaps that should be resolved to reduce the attack surface and support defence-in-depth.</p>`);
    } else {
      parts.push(`<p>No exploitable vulnerabilities were confirmed within the tested scope at the time of testing.</p>`);
    }
  }

  // Risk overview panel
  const markerPct = Math.min(100, Math.max(0, risk.score * 10));
  const maxCount = Math.max(1, ...ORDER.map(k => counts[k]));
  parts.push(`<h3 class="kwn">Overall Risk Posture</h3>`);
  parts.push(`<div class="risk-grid nosplit">
    <div class="score-card">
      <div class="lab">Overall Risk Score</div>
      <div class="val">${risk.score.toFixed(1)}<small> / 10</small></div>
      <span class="lvl ${levelCls}">${esc(levelLabel.toUpperCase())}</span>
      <svg class="scale" viewBox="0 0 200 18" width="100%" height="18" role="img" aria-label="Risk scale">
        <rect x="0" y="6" width="200" height="6" rx="3" fill="#DC2626"/>
        <rect x="0" y="6" width="180" height="6" rx="3" fill="#B9623C"/>
        <rect x="0" y="6" width="140" height="6" rx="3" fill="#B7791F"/>
        <rect x="0" y="6" width="80" height="6" rx="3" fill="#006FE3"/>
        <circle cx="${(markerPct * 2).toFixed(1)}" cy="9" r="5.5" fill="#fff" stroke="#001B41" stroke-width="2"/>
      </svg>
      <div class="note">${esc(risk.method)} across ${risk.scoredFindings} scored finding${risk.scoredFindings === 1 ? '' : 's'}. Highest single finding: CVSS ${risk.maxCvss.toFixed(1)}.</div>
    </div>
    <div class="dist">
      <div class="ttl">Findings by Severity</div>
      ${ORDER.map(k => `<div class="dist-row"><span>${sevPill(k)}</span><div class="bar"><span class="bg-${SEV[k].cls}" style="width:${((counts[k] / maxCount) * 100).toFixed(1)}%"></span></div><span class="n">${counts[k]}</span></div>`).join('')}
      <div class="foot"><span>Total confirmed findings</span><b>${total}</b></div>
    </div>
  </div>`);

  if (topFindings.length) {
    parts.push(`<h3 class="kwn">Key Findings</h3>`);
    parts.push(`<table><thead><tr><th style="width:9%">Ref</th><th>Finding</th><th style="width:15%">Severity</th><th class="num" style="width:10%">CVSS</th></tr></thead><tbody>
      ${topFindings.map((v, i) => `<tr><td class="nw"><strong>F-${String(i + 1).padStart(2, '0')}</strong></td><td>${esc(cleanTitle(v.title))}</td><td>${sevPill(v.severity)}</td><td class="num"><strong>${getFindingCvss(v).toFixed(1)}</strong></td></tr>`).join('')}
    </tbody></table>`);
  }

  parts.push(`<h3 class="kwn">Strategic Recommendations</h3>`);
  parts.push(`<div class="roadmap nosplit">
    <div class="rm r1"><div class="w">Immediate &middot; 0–7 days</div><b>Contain critical exposure</b><p>${counts.CRITICAL + counts.HIGH > 0 ? `Remediate the ${counts.CRITICAL + counts.HIGH} critical/high finding${counts.CRITICAL + counts.HIGH === 1 ? '' : 's'}, starting with F-01. Apply compensating controls (WAF rules, access restrictions) where a fix cannot be deployed immediately.` : 'No critical or high findings require emergency action. Validate that existing perimeter controls remain effective.'}</p></div>
    <div class="rm r2"><div class="w">Short term &middot; 30 days</div><b>Close remaining gaps</b><p>${counts.MEDIUM > 0 ? `Resolve the ${counts.MEDIUM} medium severity finding${counts.MEDIUM === 1 ? '' : 's'} in the next release cycle: input handling, security headers, configuration and access-control hardening.` : 'Review configuration baselines and security headers across all in-scope hosts.'}</p></div>
    <div class="rm r3"><div class="w">Ongoing &middot; 90 days</div><b>Sustain assurance</b><p>Address low-risk items, add security checks to the CI/CD pipeline, and schedule a re-test to verify that all fixes are effective.</p></div>
  </div>`);

  // 2. Scope & methodology (flows on directly — no forced page break)
  parts.push(section('sec-scope', '2', 'Scope & Methodology'));
  parts.push(`<h3 class="kwn">Engagement Scope</h3>`);
  parts.push(`<table class="kv"><tbody>
    <tr><td class="k">Client</td><td>${client}</td></tr>
    <tr><td class="k">Primary Target</td><td class="mono">${esc(targetUrl)}</td></tr>
    <tr><td class="k">Assessment Type</td><td>${assessmentType}</td></tr>
    <tr><td class="k">Testing Approach</td><td>Black-box, unauthenticated external testing using the Sennovate autonomous VAPT engine with exploit validation</td></tr>
    <tr><td class="k">Testing Window</td><td>${esc(testWindow)}${metadata.durationFormatted ? ` (${esc(metadata.durationFormatted)})` : ''}</td></tr>
    <tr><td class="k">Hosts in Scope</td><td>${hosts.length || 1}</td></tr>
  </tbody></table>`);
  if (hosts.length) {
    const perHost = {};
    vulns.forEach(v => { const h = hostOf(getCompleteTargetUrl(v, targetUrl)); if (h) perHost[h] = (perHost[h] || 0) + 1; });
    parts.push(`<h3 class="kwn">Assets Assessed</h3>`);
    parts.push(`<table><thead><tr><th style="width:8%">#</th><th>Host</th><th class="num" style="width:20%">Findings</th></tr></thead><tbody>
      ${hosts.map((h, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(h)}</td><td class="num">${perHost[h] || 0}</td></tr>`).join('')}
    </tbody></table>`);
  }
  parts.push(`<h3 class="kwn">Methodology</h3>`);
  parts.push(`<p>Testing followed industry-recognised frameworks, including the <strong>OWASP Web Security Testing Guide (WSTG v4.2)</strong>, the <strong>OWASP API Security Top 10</strong>, <strong>NIST SP 800-115</strong> and the <strong>CWE/SANS Top 25</strong>. Each finding was validated with a non-destructive proof of concept and scored using <strong>CVSS v3.1</strong>.</p>`);
  parts.push(`<div class="phases nosplit">
    <div class="phase"><span class="n">PHASE 1</span><b>Reconnaissance</b>Asset discovery, subdomain enumeration and technology fingerprinting.</div>
    <div class="phase"><span class="n">PHASE 2</span><b>Discovery</b>Automated and AI-driven testing of inputs, authentication, APIs and configuration.</div>
    <div class="phase"><span class="n">PHASE 3</span><b>Exploitation</b>Safe, non-destructive validation of each issue to eliminate false positives.</div>
    <div class="phase"><span class="n">PHASE 4</span><b>Reporting</b>Risk scoring, business impact analysis and remediation guidance.</div>
  </div>`);
  parts.push(`<h3 class="kwn">Limitations</h3>`);
  parts.push(`<p>This assessment reflects the security posture of the in-scope assets at the time of testing. Testing was time-boxed and performed without source code or credentials unless stated otherwise; denial-of-service and social engineering were out of scope. New vulnerabilities may emerge as systems change, so periodic re-assessment is recommended.</p>`);

  // 3. Risk rating
  parts.push(section('sec-rating', '3', 'Risk Rating Methodology'));
  parts.push(`<p>Each finding is rated using the CVSS v3.1 base score, mapped to the qualitative severity levels and remediation timeframes below.</p>`);
  parts.push(`<table><thead><tr><th style="width:17%">Severity</th><th style="width:14%">CVSS v3.1</th><th>Description</th><th style="width:20%">Recommended SLA</th></tr></thead><tbody>
    ${ORDER.map(k => `<tr><td>${sevPill(k)}</td><td>${SEV[k].range}</td><td>${esc(SEV[k].desc)}</td><td>${esc(SEV[k].sla)}</td></tr>`).join('')}
  </tbody></table>`);
  parts.push(`<h3 class="kwn">Overall Risk Score</h3>`);
  parts.push(`<div class="callout"><p>The overall score represents the <strong>whole assessment</strong>, not a single finding. It is the severity-weighted average of the CVSS scores of all confirmed findings, where each finding is weighted by its severity (Critical ×10, High ×5, Medium ×2, Low ×1; informational items are excluded). This keeps critical issues dominant while reflecting the overall volume and mix of risk. The resulting score is mapped to the same severity bands shown above.</p></div>`);

  // 4. Findings summary
  parts.push(section('sec-summary', '4', 'Summary of Findings'));
  if (total) {
    parts.push(`<table><thead><tr><th style="width:9%">Ref</th><th>Finding</th><th style="width:13%">Severity</th><th class="num" style="width:8%">CVSS</th><th style="width:11%">CWE</th><th style="width:24%">Affected Asset</th></tr></thead><tbody>
      ${vulns.map((v, i) => `<tr><td class="nw"><strong>F-${String(i + 1).padStart(2, '0')}</strong></td><td>${esc(cleanTitle(v.title))}</td><td>${sevPill(v.severity)}</td><td class="num"><strong>${getFindingCvss(v).toFixed(1)}</strong></td><td class="nw">${esc(shortCwe(v.cwe))}</td><td class="mono">${esc(getCompleteTargetUrl(v, targetUrl).replace(/^https?:\/\//, ''))}</td></tr>`).join('')}
    </tbody></table>`);
  } else {
    parts.push(`<p>No findings were confirmed within the tested scope.</p>`);
  }

  // 5. Detailed findings
  if (total) {
    parts.push(`<div data-break="page"></div>`);
    parts.push(section('sec-findings', '5', detailed ? 'Detailed Findings' : 'Findings & Remediation'));
    vulns.forEach((v, i) => {
      const ref = `F-${String(i + 1).padStart(2, '0')}`;
      const sev = SEV[v.severity] || SEV.INFO;
      const url = getCompleteTargetUrl(v, targetUrl);
      const fid = `finding-${i + 1}`;
      tocEntries.push({ id: fid, num: ref, name: cleanTitle(v.title), sub: true });
      const kvRows = [
        `<tr><td class="k">Severity</td><td>${sevPill(v.severity)}</td><td class="k">CVSS v3.1</td><td><strong>${getFindingCvss(v).toFixed(1)}</strong></td></tr>`,
        v.cvssVector ? `<tr><td class="k">CVSS Vector</td><td colspan="3" class="mono">${esc(v.cvssVector)}</td></tr>` : '',
        `<tr><td class="k">Weakness (CWE)</td><td colspan="3">${esc(shortCwe(v.cwe))}${v.cweName ? ` &mdash; ${esc(v.cweName)}` : ''}</td></tr>`,
        v.cve ? `<tr><td class="k">CVE</td><td colspan="3">${esc(v.cve)}</td></tr>` : '',
        `<tr><td class="k">Affected Asset</td><td colspan="3" class="mono">${esc(url)}</td></tr>`,
        `<tr><td class="k">HTTP Method</td><td>${esc(v.method || '—')}</td><td class="k">Fix Effort</td><td>${esc(v.fixEffort || 'Medium')}</td></tr>`,
        `<tr><td class="k">Finding ID</td><td>${esc(v.id || ref)}</td><td class="k">Status</td><td>Open</td></tr>`
      ].filter(Boolean).join('');
      const poc = v.pocScripts && typeof v.pocScripts === 'object' ? v.pocScripts : {};
      const pocBlocks = [
        poc.bash ? codeBlock(poc.bash, 'Verification command (bash)') : '',
        poc.python ? codeBlock(poc.python, 'Proof of concept (python)') : '',
        poc.javascript ? codeBlock(poc.javascript, 'Proof of concept (javascript)') : '',
        !poc.bash && !poc.python && !poc.javascript && v.reproduction ? codeBlock(v.reproduction, 'Reproduction') : ''
      ].join('');
      const steps = Array.isArray(v.remediationSteps) ? v.remediationSteps.map(s => cleanTitle(typeof s === 'string' ? s : (s?.description || s?.title || str(s)))).filter(Boolean) : [];

      let body = `<div class="finding" id="${fid}" data-min-space="230">
        <div class="finding-head nosplit kwn">
          <div class="bar bg-${sev.cls}"></div>
          <div class="inner">
            <div><div class="ref">${ref} &middot; ${esc(sev.label)} Severity</div><div class="title">${esc(cleanTitle(v.title))}</div></div>
            <div class="score">${sevPill(v.severity)}<div class="cv">${getFindingCvss(v).toFixed(1)}<small>CVSS v3.1</small></div></div>
          </div>
        </div>
        <table class="kv kv4 nosplit"><tbody>${kvRows}</tbody></table>
        <h4 class="kwn">Description</h4>${richText(v.description) || '<p>No description provided by the scanner.</p>'}`;
      if (detailed && v.technicalAnalysis) body += `<h4 class="kwn">Technical Analysis</h4>${richText(v.technicalAnalysis)}`;
      body += `<h4 class="kwn">Business Impact</h4>${richText(v.impact) || '<p>Successful exploitation could affect the confidentiality, integrity or availability of the affected application and its data.</p>'}`;
      if (detailed) {
        if (v.pocDescription || pocBlocks) {
          body += `<h4 class="kwn">Proof of Concept</h4>${richText(v.pocDescription)}${pocBlocks}`;
        }
        if (v.evidence) body += `<h4 class="kwn">Evidence</h4>${codeBlock(v.evidence)}`;
      }
      body += `<h4 class="kwn">Remediation</h4>${v.remediation ? richText(v.remediation) : ''}`;
      if (steps.length) body += `<ol>${steps.map(s => `<li>${inlineMd(esc(s))}</li>`).join('')}</ol>`;
      if (!v.remediation && !steps.length) body += `<p>Apply strict input validation and least-privilege access control on the affected component, then re-test to confirm the fix.</p>`;
      if (detailed && v.assumptions) body += `<h4 class="kwn">Notes &amp; Assumptions</h4>${richText(v.assumptions)}`;
      body += `</div>`;
      parts.push(body);
    });
  }

  // Appendix
  parts.push(`<div data-break="page"></div>`);
  parts.push(section('sec-appendix', 'A', 'Appendix — Disclaimer & Confidentiality'));
  parts.push(`<p>This report is provided to ${client} for the sole purpose of improving its security posture. It contains confidential information about potential weaknesses in the client's systems and must be handled and distributed accordingly.</p>`);
  parts.push(`<p>The findings reflect the state of the assessed systems at the time of testing and within the agreed scope. Sennovate makes no guarantee that all vulnerabilities have been identified, and the absence of a finding does not imply that a system is free from security issues. Proofs of concept were executed in a non-destructive manner.</p>`);
  parts.push(`<p>For questions about this report or to schedule a re-test, contact your Sennovate account team at <strong>www.sennovate.com</strong>.</p>`);

  const tocHtml = tocEntries.map(t => `<div class="toc-row${t.sub ? ' sub' : ''}"><span class="n">${esc(t.num)}</span><span class="t">${esc(t.name)}</span><span class="p" data-toc-ref="${t.id}"></span></div>`).join('');
  const flowHtml = parts.join('\n').replace('<div class="toc" id="toc-slot"></div>', `<div class="toc">${tocHtml}</div>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`Sennovate VAPT Report — ${companyName}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<style>${REPORT_CSS}</style>
</head>
<body>
${pageTemplate}
<div id="report-book">
${cover}
</div>
<div id="report-flow" style="width:174mm">
${flowHtml}
</div>
<script>
(function(){
  var run = ${paginateReport.toString()};
  var done = false;
  function go(){ if (done) return; done = true; try { run(); } catch (e) { console.error('Pagination failed', e); document.documentElement.setAttribute('data-paginated','error'); } }
  function start(){
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function(r){ setTimeout(r, 4000); })]).then(function(){ setTimeout(go, 0); });
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
</script>
</body>
</html>`;
}
