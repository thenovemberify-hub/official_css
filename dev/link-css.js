/**
 * Bascule le <link> CSS de la page entre le CSS officiel (GitHub Pages) et le test.css local.
 *
 *   npm run link:test                 # html/main_page.html -> ../css/official_css/test.css
 *   npm run link:official             # remet l'URL GitHub Pages (main.css)
 *   npm run link:status               # indique la cible actuelle, sans rien modifier
 *   npm run link:test -- autre.html   # autre page du dossier html
 *
 * - Idempotent : relancer la commande ne change rien si le lien est déjà bon.
 * - Seul le <link> actif est modifié ; les liens dans les commentaires <!-- --> restent intacts.
 * - Pour garder test.css à jour : `npm run watch` (compile src/ -> test.css à chaque modification).
 *
 * Variables optionnelles : PAGES_DIR
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.resolve(process.env.PAGES_DIR || path.join(ROOT, '..', '..', 'html'));

const OFFICIAL_URL = 'https://thenovemberify-hub.github.io/official_css/main.css';
const TEST_FILE = path.join(ROOT, 'test.css');

const [mode, pageName = 'main_page.html'] = process.argv.slice(2);
if (!['test', 'official', 'status'].includes(mode)) {
    console.error('Usage : link-css.js <test|official|status> [page.html]');
    process.exit(1);
}

const page = path.join(PAGES_DIR, pageName);
if (!fs.existsSync(page)) {
    console.error(`❌ Page introuvable : ${page}`);
    process.exit(1);
}

// Chemin relatif de la page vers test.css, en slashs avant (ex. ../css/official_css/test.css)
const testHref = path.relative(path.dirname(page), TEST_FILE).split(path.sep).join('/');
const targets = { test: testHref, official: OFFICIAL_URL };

const html = fs.readFileSync(page, 'utf8');

// Plages occupées par des commentaires HTML : un <link> à l'intérieur est inactif
const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map(m => [m.index, m.index + m[0].length]);
const inComment = i => comments.some(([from, to]) => i >= from && i < to);

const LINK_RE = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
const HREF_RE = /(\bhref=["'])([^"']+)(["'])/i;
const isOurs = href => href === OFFICIAL_URL || href === testHref || /(^|\/)test\.css$/.test(href) && !/^https?:/.test(href);

const links = [...html.matchAll(LINK_RE)]
    .filter(m => !inComment(m.index))
    .filter(m => isOurs((m[0].match(HREF_RE) || [])[2] || ''));

if (links.length !== 1) {
    console.error(links.length === 0
        ? `❌ Aucun <link> vers ${OFFICIAL_URL} ou test.css trouvé hors commentaire dans ${pageName}`
        : `❌ ${links.length} <link> candidats dans ${pageName} : ambigu, rien n'a été modifié`);
    process.exit(1);
}

const [link] = links;
const current = link[0].match(HREF_RE)[2];

if (mode === 'status') {
    console.log(`${pageName} → ${current} (${current === OFFICIAL_URL ? 'officiel' : 'test local'})`);
    process.exit(0);
}

if (current === targets[mode]) {
    console.log(`✔ ${pageName} pointe déjà vers ${current}`);
} else {
    const updated = link[0].replace(HREF_RE, `$1${targets[mode]}$3`);
    fs.writeFileSync(page, html.slice(0, link.index) + updated + html.slice(link.index + link[0].length));
    console.log(`✅ ${pageName} : ${current} → ${targets[mode]}`);
}

if (mode === 'test' && !fs.existsSync(TEST_FILE)) {
    console.log('⚠️  test.css n\'existe pas encore : lance `npm run build:test` ou `npm run watch`');
}
