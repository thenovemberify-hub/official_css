import fs from 'fs/promises';
import path from 'path';
import postcss from 'postcss';

const SRC_DIR = './src';
const INPUT_FILE = './style-deduped.css'; // Ton fichier de 12 000 lignes

// Règles de classification basées sur le sélecteur / type de règle
const RULES_MAPPING = [
    // 00. Variables, Polices & Layers
    {
        file: '00-variables.css',
        match: (node) => {
            if (node.type === 'atrule' && ['import', 'layer', 'keyframes', 'font-face'].includes(node.name)) return true;
            if (node.type === 'rule' && /(:root|\[data-theme)/i.test(node.selector)) return true;
            return false;
        }
    },
    // 01. Reset & Éléments HTML de base
    {
        file: '01-base.css',
        match: (node) => {
            if (node.type === 'rule') {
                return /^(html|body|\*|a\b|p\b|h[1-6]\b|ul|ol|li\b|img|table\b|button\b|input\b|select\b|textarea\b)/i.test(node.selector);
            }
            return false;
        }
    },
    // 02. Structure générale & Navigation
    {
        file: '02-layout.css',
        match: (node) => node.type === 'rule' && /(wrap|header|footer|navbar|navlink|breadcrumb|pagination|sidebar|main_forum)/i.test(node.selector)
    },
    // 03. Catégories & Index Forumactif
    {
        file: '03-categories.css',
        match: (node) => node.type === 'rule' && /(forabg|forumbg|topiclist|forumline|topictitle|forumtitle|lastpost|cat-)/i.test(node.selector)
    },
    // 04. Topics & Messages
    {
        file: '04-topics.css',
        match: (node) => node.type === 'rule' && /(postbody|postprofile|signature|\.post\b|\.topic\b|post-|quickreply)/i.test(node.selector)
    },
    // 05. Profils, Membres & Messages Privés
    {
        file: '05-user-ui.css',
        match: (node) => node.type === 'rule' && /(memberlist|main-profile|avatar|profile|privmsgs|pm-message|user-|switcheroo)/i.test(node.selector)
    },
    // 06. Éditeur de texte (SCEditor) & Formulaires d'envoi
    {
        file: '06-posting.css',
        match: (node) => node.type === 'rule' && /(sceditor|posting|format-button|spoiler|codebox|colorpicker)/i.test(node.selector)
    },
    // 07. Fiches de RP personnalisées (spécifiques Velvet Sin)
    {
        file: '07-rp-templates.css',
        match: (node) => node.type === 'rule' && /(\.vs-|fiche-|dossier|rorschach|casting|scenarios|previsu)/i.test(node.selector)
    }
];

async function splitCSS() {
    await fs.mkdir(SRC_DIR, { recursive: true });

    console.log(`📖 Lecture de ${INPUT_FILE}...`);
    const rawCss = await fs.readFile(INPUT_FILE, 'utf8');

    console.log(`⚙️  Analyse syntaxique (PostCSS AST)...`);
    const root = postcss.parse(rawCss);

    const outputs = {
        '00-variables.css': [],
        '01-base.css': [],
        '02-layout.css': [],
        '03-categories.css': [],
        '04-topics.css': [],
        '05-user-ui.css': [],
        '06-posting.css': [],
        '07-rp-templates.css': [],
        '08-plugins.css': [] // Reste / Non catégorisé
    };

    let pendingComments = [];

    for (const node of root.nodes) {
        // On conserve les commentaires pour les attacher à la règle qui suit
        if (node.type === 'comment') {
            pendingComments.push(node.toString());
            continue;
        }

        let targetFile = '08-plugins.css';

        // Pour les @media, on analyse les sélecteurs à l'intérieur
        if (node.type === 'atrule' && node.name === 'media') {
            const innerRules = node.nodes?.filter(n => n.type === 'rule') || [];
            for (const rule of RULES_MAPPING) {
                if (innerRules.some(r => rule.match(r))) {
                    targetFile = rule.file;
                    break;
                }
            }
        } else {
            // Pour les règles standard et autres @rules
            for (const rule of RULES_MAPPING) {
                if (rule.match(node)) {
                    targetFile = rule.file;
                    break;
                }
            }
        }

        const nodeStr = (pendingComments.length > 0 ? pendingComments.join('\n') + '\n' : '') + node.toString();
        outputs[targetFile].push(nodeStr);
        pendingComments = [];
    }

    // Écriture des sous-fichiers et génération de index.css
    let indexContent = '/* Fichier généré automatiquement — Velvet Sin */\n\n';

    for (const [filename, content] of Object.entries(outputs)) {
        if (content.length > 0) {
            await fs.writeFile(path.join(SRC_DIR, filename), content.join('\n\n'), 'utf8');
            indexContent += `@import "./${filename}";\n`;
            console.log(`✅ ${filename} : ${content.length} blocs exportés.`);
        } else {
            console.log(`⚪ ${filename} : 0 règle.`);
        }
    }

    await fs.writeFile(path.join(SRC_DIR, 'index.css'), indexContent, 'utf8');
    console.log('\n🎉 Découpage propre terminé avec succès dans src/ !');
}

splitCSS().catch(console.error);