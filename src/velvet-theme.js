/**
 * Velvet Sin - Gestionnaire de Thèmes Dynamiques
 * Permet de basculer instantanément entre les thèmes (ex: 'bleu_nuit', 'vert_foret')
 * avec persistance dans le localStorage.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'velvet_sin_theme';
    var DEFAULT_THEME = 'bleu_nuit';

    // Configuration des avatars du staff par thème
    var THEME_STAFF_AVATARS = {
        bleu_nuit: {
            sinclair: 'https://imagesend.fr/uploads/20260501/847c8eeb020fd8e6b7e57999d33d0e97d2fccb1f.jpg',
            vanda: 'https://imagesend.fr/uploads/20260503/0694a34da1daa36cc728ebbf647f3eae6aef554e.jpg'
        },
        vert_foret: {
            sinclair: 'https://imagesend.fr/uploads/20260828/d208f60fbf850c7acb0ed29031d1486083b4d6fb.jpg',
            vanda: 'https://imagesend.fr/uploads/20260828/938780a5f690ca33259a6aa3abbee47d7a961d67.jpg'
        }
    };

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

        // 4. Mise à jour dynamique des images du staff
        updateStaffAvatars(themeName);
    };

    /**
     * Met à jour dynamiquement les avatars du staff sur la page d'accueil
     * @param {string} currentTheme
     */
    function updateStaffAvatars(currentTheme) {
        var avatars = THEME_STAFF_AVATARS[currentTheme] || THEME_STAFF_AVATARS[DEFAULT_THEME];
        if (!avatars) return;
        Object.keys(avatars).forEach(function (name) {
            var img = document.querySelector('.vs-hp-avatar[data-name="' + name + '"] img');
            if (img) {
                img.src = avatars[name];
            }
        });
    }

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

        // Appliquer l'état actif sur les boutons et les avatars au chargement
        var savedTheme = getSavedTheme();
        updateThemeButtons(savedTheme);
        updateStaffAvatars(savedTheme);
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
