    function activateTab(targetId) {
        refs.tabButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.target === targetId);
        });

        refs.views.forEach((view) => {
            view.classList.toggle("hidden", view.id !== targetId);
        });

        if (targetId === "view-saved") {
            renderSavedWords();
        }
    }

    function initTabs() {
        refs.tabButtons.forEach((button) => {
            button.addEventListener("click", () => activateTab(button.dataset.target));
        });
    }
