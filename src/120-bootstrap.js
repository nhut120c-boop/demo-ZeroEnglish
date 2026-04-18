    function updateStatusBanner(message, warning) {
        if (!refs.appStatusBanner) return;
        refs.appStatusBanner.textContent = message;
        refs.appStatusBanner.classList.toggle("warning", Boolean(warning));
    }

    function syncStrictAiButtons() {
        refs.strictAiButtons.forEach((button) => {
            button.disabled = !state.bootstrap.aiEnabled;
            button.title = state.bootstrap.aiEnabled
                ? ""
                : "Tính năng AI hiện đang bảo trì hoặc chưa khả dụng. Vui lòng thử lại sau.";
        });
    }

    async function initBootstrapStatus() {
        try {
            const bootstrap = await api.getBootstrap();
            state.bootstrap = bootstrap;
            if (bootstrap.aiEnabled) {
                updateStatusBanner("Hệ thống ZeroEnglish đã kết nối. Trợ lý AI học thuật sẵn sàng.", false);
            } else {
                updateStatusBanner("Hệ thống AI đang bảo trì. Các tính năng luyện tập tiêu chuẩn vẫn hoạt động bình thường.", true);
            }
        } catch (error) {
            updateStatusBanner("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền internet.", true);
        } finally {
            syncStrictAiButtons();
        }
    }

    function initApp() {
        initTabs();
        initFlashcards();
        initReading();
        initGrammar();
        initChat();
        initListening();
        initMatching();
        initChinese();
        initBootstrapStatus();

        window.addEventListener("beforeunload", () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        });
    }

    initApp();
