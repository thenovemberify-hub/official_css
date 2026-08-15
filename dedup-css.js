import fs from 'fs/promises';
import postcss from 'postcss';
import combineSelectors from 'postcss-combine-duplicated-selectors';
import sortMediaQueries from 'postcss-sort-media-queries';
import prettier from 'prettier';

const INPUT_FILE = './style.css';           // Ton fichier de 12 000 lignes
const OUTPUT_FILE = './style-deduped.css';  // Fichier propre prêt pour le split

async function deduplicateCSS() {
    console.log(`⏳ Lecture du fichier ${INPUT_FILE}...`);
    const css = await fs.readFile(INPUT_FILE, 'utf8');

    console.log('🔄 Fusion des sélecteurs et réorganisation des media queries...');
    const result = await postcss([
        // 1. Fusionne les sélecteurs dupliqués (.postprofile { ... } .postprofile { ... })
        combineSelectors({
            removeDuplicatedProperties: true,
            removeDuplicatedValues: true
        }),
        // 2. Regroupe tous les @media (desktop-first pour les règles max-width de Forumactif)
        sortMediaQueries({
            sort: 'desktop-first'
        })
    ]).process(css, { from: INPUT_FILE, to: OUTPUT_FILE });

    console.log('✨ Reformatage propre avec Prettier (indentation 2 espaces)...');
    const formattedCSS = await prettier.format(result.css, {
        parser: 'css',
        tabWidth: 2
    });

    await fs.writeFile(OUTPUT_FILE, formattedCSS, 'utf8');

    const initialLines = css.split('\n').length;
    const finalLines = formattedCSS.split('\n').length;

    console.log(`\n🎉 Dédoublonnage & formatage terminés !`);
    console.log(`📊 Lignes initiales : ${initialLines}`);
    console.log(`📊 Lignes finales   : ${finalLines} (~${Math.round((1 - finalLines / initialLines) * 100)}% de réduction)`);
    console.log(`📁 Fichier généré   : ${OUTPUT_FILE}`);
}

deduplicateCSS().catch(console.error);