    // ── Language switcher (EN / CN) ──────────────────────────
    (function initLangSwitcher() {
        const langBtns = Array.from(document.querySelectorAll(".lang-btn"));
        const enPanels = Array.from(document.querySelectorAll(".lang-panel-en"));
        const cnPanels = Array.from(document.querySelectorAll(".lang-panel-cn"));

        function activateLang(lang) {
            langBtns.forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
            if (lang === "en") {
                enPanels.forEach((p) => p.classList.remove("hidden"));
                cnPanels.forEach((p) => p.classList.add("hidden"));
                // activate default English tab
                const firstEnTab = document.querySelector('.lang-panel-en .tab-btn.active');
                if (!firstEnTab) {
                    const firstBtn = document.querySelector('.lang-panel-en .tab-btn');
                    if (firstBtn) firstBtn.click();
                }
            } else {
                cnPanels.forEach((p) => p.classList.remove("hidden"));
                enPanels.forEach((p) => p.classList.add("hidden"));
                // activate default Chinese tab
                const firstCnTab = document.querySelector('.lang-panel-cn .tab-btn.active');
                if (!firstCnTab) {
                    const firstBtn = document.querySelector('.lang-panel-cn .tab-btn');
                    if (firstBtn) firstBtn.click();
                }
            }
        }

        langBtns.forEach((btn) => {
            btn.addEventListener("click", () => activateLang(btn.dataset.lang));
        });

        // Default: show EN
        activateLang("en");
    })();
