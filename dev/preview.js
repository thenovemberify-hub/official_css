/**
 * Preview local — retour visuel immédiat sans déployer le CSS.
 *
 *   npm run preview            # http://localhost:5183
 *   npm run preview -- --open  # ouvre aussi le navigateur
 *
 * - Sert les pages .html du dossier PAGES_DIR (par défaut ../../html).
 * - Remplace le <link> vers main.css (GitHub Pages) par le CSS compilé en direct depuis src/.
 * - Le reste de la page (scripts du forum, polices, images...) vient du vrai forum
 *   grâce à une balise <base> injectée.
 * - Recompile et met à jour la page à chaque modification de src/ (sans recharger la page),
 *   recharge la page si un .html change.
 *
 * Variables optionnelles : PORT, PAGES_DIR, FORUM_ORIGIN, LIVE_CSS_URL, KEEP_ADS=1
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import loadConfig from '../postcss.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const ENTRY = path.join(SRC_DIR, 'index.css');
const PAGES_DIR = path.resolve(process.env.PAGES_DIR || path.join(ROOT, '..', '..', 'html'));
const PORT = Number(process.env.PORT) || 5183;
const LIVE_CSS_URL = process.env.LIVE_CSS_URL || 'https://thenovemberify-hub.github.io/official_css/main.css';
const KEEP_ADS = process.env.KEEP_ADS === '1';

// ── Compilation CSS (même config que `npm run build:test`) ────────────────────

let compiledCss = '/* build en cours... */';
let buildError = null;

async function build() {
    const started = Date.now();
    try {
        const css = fs.readFileSync(ENTRY, 'utf8');
        const { plugins } = loadConfig({ env: 'development' });
        const result = await postcss(plugins).process(css, { from: ENTRY, map: { inline: true } });
        compiledCss = result.css;
        buildError = null;
        console.log(`✅ CSS compilé en ${Date.now() - started} ms (${Math.round(result.css.length / 1024)} Ko avec source map)`);
    } catch (e) {
        buildError = e.reason ? `${e.file ? path.relative(ROOT, e.file) : ''}:${e.line || '?'} ${e.reason}` : e.message;
        console.error(`❌ Erreur CSS : ${buildError}`);
    }
}

// ── Live reload (Server-Sent Events) ──────────────────────────────────────────

const clients = new Set();
function broadcast(type, data = '') {
    for (const res of clients) res.write(`event: ${type}\ndata: ${data}\n\n`);
}

const clientScript = origin => `<script>(function(){
  var ORIGIN='${origin}';
  var banner;
  function showError(msg){
    if(!banner){banner=document.createElement('div');banner.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#b00020;color:#fff;font:13px/1.4 monospace;padding:8px 12px;white-space:pre-wrap';document.documentElement.appendChild(banner);}
    banner.textContent='Erreur CSS : '+msg;banner.style.display='block';
  }
  var es=new EventSource(ORIGIN+'/__events');
  es.addEventListener('css',function(){
    if(banner)banner.style.display='none';
    document.querySelectorAll('link[rel=stylesheet]').forEach(function(l){
      if(l.href.indexOf('/__live.css')===-1)return;
      var n=l.cloneNode();n.href=ORIGIN+'/__live.css?t='+Date.now();
      n.onload=function(){l.remove();};l.after(n);
    });
  });
  es.addEventListener('cssError',function(e){showError(e.data);});
  es.addEventListener('html',function(){location.reload();});
})();</script>`;

// ── Transformation des pages ──────────────────────────────────────────────────

const AD_SCRIPT_RE = /<script\b[^>]*(?:consentframework|viously|prebid|googletagmanager|audiencerun|adnext)[^>]*>\s*<\/script>/gis;

function detectOrigin(html) {
    if (process.env.FORUM_ORIGIN) return process.env.FORUM_ORIGIN.replace(/\/$/, '');
    const m = html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
    if (m) {
        try { return new URL(m[1]).origin; } catch { /* ignore */ }
    }
    return null;
}

function transform(html, localOrigin, live = true) {
    const origin = detectOrigin(html);
    const report = [];

    // URL absolue obligatoire : avec <base>, une URL relative pointerait vers le forum.
    // Notre CSS live remplace celui de GitHub Pages (également dans les commentaires, sans effet)
    const before = html;
    html = html.split(LIVE_CSS_URL).join(`${localOrigin}/__live.css`);
    if (html === before) report.push(`⚠️  lien vers ${LIVE_CSS_URL} introuvable dans la page`);

    // Les chemins relatifs (/0-ltr.css, /99581.js...) pointent vers le vrai forum
    if (origin && !/<base\b/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, m => `${m}<base href="${origin}/">`);
    } else if (!origin) {
        report.push('⚠️  origine du forum introuvable (og:url) : les ressources relatives ne chargeront pas');
    }

    if (!KEEP_ADS) html = html.replace(AD_SCRIPT_RE, '');

    // ?nolive : pas de rechargement automatique (captures d'écran, tests)
    if (live) {
        html = /<\/body>/i.test(html)
            ? html.replace(/<\/body>/i, `${clientScript(localOrigin)}</body>`)
            : html + clientScript(localOrigin);
    }

    return { html, report };
}

// ── Serveur HTTP ──────────────────────────────────────────────────────────────

function listPages() {
    return fs.readdirSync(PAGES_DIR).filter(f => f.toLowerCase().endsWith('.html')).sort();
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/__events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive'
        });
        res.write('retry: 1000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }

    if (pathname === '/__live.css') {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(compiledCss);
    }

    if (pathname === '/') {
        const pages = listPages();
        if (pages.length === 1) {
            res.writeHead(302, { Location: `/${pages[0]}` });
            return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8"><title>Preview</title>
<body style="font:16px system-ui;padding:2rem"><h1>Pages disponibles</h1><ul>${pages.map(p => `<li><a href="/${encodeURI(p)}">${esc(p)}</a></li>`).join('')}</ul>
<p style="color:#666">Dossier : ${esc(PAGES_DIR)}</p></body>`);
    }

    // Une page = un fichier .html directement dans PAGES_DIR (pas de sous-dossier : évite toute sortie du dossier)
    const name = pathname.slice(1);
    if (/^[^/\\]+\.html$/i.test(name)) {
        const file = path.join(PAGES_DIR, name);
        if (fs.existsSync(file)) {
            const { html, report } = transform(fs.readFileSync(file, 'utf8'), `http://${req.headers.host}`, !url.searchParams.has('nolive'));
            report.forEach(r => console.log(`${name} ${r}`));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            return res.end(html);
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — seules les pages .html de ' + PAGES_DIR + ' sont servies ici.');
});

server.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? `❌ Le port ${PORT} est déjà utilisé (essaie : PORT=5184 npm run preview)` : e);
    process.exit(1);
});

// ── Surveillance des fichiers ─────────────────────────────────────────────────

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const onCssChange = debounce(async () => {
    await build();
    if (buildError) broadcast('cssError', buildError.replace(/\n/g, ' '));
    else broadcast('css');
}, 120);

const onHtmlChange = debounce(() => {
    console.log('📄 Page modifiée, rechargement.');
    broadcast('html');
}, 150);

// Sous WSL, les fichiers de /mnt/c, /mnt/d... modifiés depuis Windows (VS Code...) ne déclenchent
// pas les événements inotify : on surveille alors par polling des dates de modification.
const IS_WSL = process.platform === 'linux' && (!!process.env.WSL_DISTRO_NAME || /microsoft/i.test(os.release()));
const USE_POLLING = process.env.POLL === '1' || (IS_WSL && ROOT.startsWith('/mnt/'));

function listFiles(dir, ext, recursive) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recursive) out.push(...listFiles(full, ext, recursive));
        } else if (entry.name.toLowerCase().endsWith(ext)) {
            out.push(full);
        }
    }
    return out;
}

function watchFiles(dir, ext, recursive, onChange) {
    if (!USE_POLLING) {
        fs.watch(dir, { recursive }, (_evt, file) => {
            if (file && file.toLowerCase().endsWith(ext)) onChange();
        });
        return;
    }
    const snapshot = () => {
        const map = new Map();
        for (const f of listFiles(dir, ext, recursive)) {
            try {
                const st = fs.statSync(f);
                map.set(f, `${st.mtimeMs}:${st.size}`);
            } catch { /* fichier supprimé entre-temps */ }
        }
        return map;
    };
    let previous = snapshot();
    setInterval(() => {
        const current = snapshot();
        let changed = current.size !== previous.size;
        for (const [f, sig] of current) if (previous.get(f) !== sig) changed = true;
        previous = current;
        if (changed) onChange();
    }, 500).unref();
}

watchFiles(SRC_DIR, '.css', true, onCssChange);
watchFiles(PAGES_DIR, '.html', false, onHtmlChange);

// ── Ouverture du navigateur (Windows, WSL, macOS, Linux) ─────────────────────

function openBrowser(url) {
    const candidates = process.platform === 'win32' ? [['cmd', ['/c', 'start', '', url]]]
        : process.platform === 'darwin' ? [['open', [url]]]
        : IS_WSL ? [['wslview', [url]], ['cmd.exe', ['/c', 'start', '', url]], ['explorer.exe', [url]]]
        : [['xdg-open', [url]]];

    const tryNext = i => {
        if (i >= candidates.length) {
            console.log(`   (ouverture automatique impossible : ouvre ${url} dans ton navigateur)`);
            return;
        }
        const [cmd, args] = candidates[i];
        const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
        child.on('error', () => tryNext(i + 1)); // ne doit jamais faire planter le serveur
        child.unref();
    };
    tryNext(0);
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

if (!fs.existsSync(PAGES_DIR)) {
    console.error(`❌ Dossier de pages introuvable : ${PAGES_DIR} (définis PAGES_DIR)`);
    process.exit(1);
}

await build();
server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n👀 Preview prêt : ${url}`);
    console.log(`   Pages : ${listPages().join(', ') || '(aucune)'}   |   Surveille : ${path.relative(process.cwd(), SRC_DIR) || 'src'}/`);
    if (USE_POLLING) console.log('   (surveillance par polling : WSL sur /mnt détecté)');
    if (process.argv.includes('--open')) openBrowser(url);
});
