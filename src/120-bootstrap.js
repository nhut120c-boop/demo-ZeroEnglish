    function updateStatusBanner(message, warning) {
        refs.appStatusBanner.textContent = message;
        refs.appStatusBanner.classList.toggle("warning", Boolean(warning));
    }

    function syncStrictAiButtons() {
        refs.strictAiButtons.forEach((button) => {
            button.disabled = !state.bootstrap.aiEnabled;
            button.title = state.bootstrap.aiEnabled
                ? ""
                : "Hãy thêm GROQ_API_KEY vào Netlify environment variables hoặc file .env để bật tính năng AI này.";
        });
    }

    async function initBootstrapStatus() {
        try {
            const bootstrap = await api.getBootstrap();
            state.bootstrap = bootstrap;

            if (bootstrap.aiEnabled) {
                updateStatusBanner("Chế độ an toàn đang bật: secret và quyền admin nằm ở server nội bộ.", false);
            } else {
                updateStatusBanner("AI đang tắt vì chưa có GROQ_API_KEY trên Netlify hoặc trong file .env. Ghép từ vẫn chạy với bộ từ fallback an toàn.", true);
            }
        } catch (error) {
            updateStatusBanner("Không kết nối được tới backend. Hãy chạy qua server.py hoặc Netlify Functions, thay vì mở file trực tiếp.", true);
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
        initBootstrapStatus();

        window.addEventListener("beforeunload", () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        });
    }

    initApp();
