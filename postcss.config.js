import postcssImport from 'postcss-import';
import combineSelectors from 'postcss-combine-duplicated-selectors';
import sortMediaQueries from 'postcss-sort-media-queries';
import cssnano from 'cssnano';

export default {
    plugins: [
        // 1. Fusionne tous les @import "./01-base.css", etc.
        postcssImport(),

        // 2. Fusionne les sélecteurs dupliqués (.postprofile { ... } .postprofile { ... })
        combineSelectors({
            removeDuplicatedProperties: true,
            removeDuplicatedValues: true
        }),

        // 3. Regroupe toutes les media queries identiques (desktop-first pour les règles max-width Forumactif)
        sortMediaQueries({
            sort: 'desktop-first'
        }),

        // 4. Minification extrême (cssnano en mode advanced)
        cssnano({
            preset: [
                'advanced',
                {
                    discardComments: { removeAll: true }, // Supprime 100% des commentaires
                    reduceIdents: false,                  // Sécurité : évite de renommer les animations keyframes utiles
                    zindex: false                         // Sécurité : ne touche pas à tes z-index Forumactif
                }
            ]
        })
    ]
};