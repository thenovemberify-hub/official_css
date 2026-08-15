/**
 * Velvet Sin - Gestionnaire de Thèmes Dynamiques
 * Permet de basculer instantanément entre les thèmes (ex: 'bleu_nuit', 'vert_foret')
 * avec persistance dans le localStorage.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'velvet_sin_theme';
    var DEFAULT_THEME = 'bleu_nuit';

    /**
     * Applique un thème au document
     * @param {string} themeName - Identifiant du thème (ex: 'bleu_nuit', 'vert_foret')
     */
    window.setTheme = function (themeName) {
        if (!themeName) themeName = DEFAULT_THEME;

        // 1. Mise à jour de l'attribut sur <html> (et <body> par compatibilité)
        document.documentElement.setAttribute('data-theme', themeName);
        if (document.body) {
            document.body.setAttribute('data-theme', themeName);
        }

        // 2. Sauvegarde dans le localStorage
        try {
            localStorage.setItem(STORAGE_KEY, themeName);
        } catch (e) {
            console.warn('[VelvetTheme] Impossible d\'accéder au localStorage', e);
        }

        // 3. Mise à jour visuelle des boutons / pips .velvet-theme
        updateThemeButtons(themeName);
    };

    /**
     * Met à jour la classe .active sur les boutons .velvet-theme
     * @param {string} currentTheme
     */
    function updateThemeButtons(currentTheme) {
        var buttons = document.querySelectorAll('.velvet-theme, [data-velvet-theme]');
        buttons.forEach(function (btn) {
            var themeTarget = btn.getAttribute('data-t') || 
                              btn.getAttribute('data-theme') || 
                              btn.getAttribute('data-velvet-theme');
            
            if (themeTarget === currentTheme) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    /**
     * Attache les écouteurs de clics automatiques sur tous les éléments .velvet-theme
     */
    function initThemeButtons() {
        var buttons = document.querySelectorAll('.velvet-theme, [data-velvet-theme]');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                var theme = btn.getAttribute('data-t') || 
                            btn.getAttribute('data-theme') || 
                            btn.getAttribute('data-velvet-theme');
                if (theme) {
                    window.setTheme(theme);
                }
            });
        });

        // Appliquer l'état actif sur les boutons au chargement
        var savedTheme = getSavedTheme();
        updateThemeButtons(savedTheme);
    }

    /**
     * Récupère le thème sauvegardé ou le thème par défaut
     */
    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
        } catch (e) {
            return DEFAULT_THEME;
        }
    }

    // --- INITIALISATION IMMÉDIATE DU THÈME (évite le flash blanc / FOUC) ---
    var initialTheme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Initialisation des boutons une fois le DOM prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if (document.body) document.body.setAttribute('data-theme', initialTheme);
            initThemeButtons();
        });
    } else {
        if (document.body) document.body.setAttribute('data-theme', initialTheme);
        initThemeButtons();
    }
})();
