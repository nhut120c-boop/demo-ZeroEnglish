function updateStatusBanner(message, warning) {
        // Chặn lỗi: Nếu đại ca đã xóa thẻ banner ở HTML thì code sẽ tự dừng, không báo lỗi đỏ màn hình
        if (!refs.appStatusBanner) return; 

        refs.appStatusBanner.textContent = message;
        refs.appStatusBanner.classList.toggle("warning", Boolean(warning));
    }

    function syncStrictAiButtons() {
        refs.strictAiButtons.forEach((button) => {
            button.disabled = !state.bootstrap.aiEnabled;
            button.title = state.bootstrap.aiEnabled
                ? ""
                // Sửa câu thông báo khi di chuột vào nút bị khóa thành văn phong lịch sự
                : "Tính năng Trợ lý AI hiện đang bảo trì hoặc chưa khả dụng. Vui lòng thử lại sau."; 
        });
    }

    async function initBootstrapStatus() {
        try {
            const bootstrap = await api.getBootstrap();
            state.bootstrap = bootstrap;

            if (bootstrap.aiEnabled) {
                // Câu thông báo thương mại, tri thức (hoặc nó sẽ ẩn luôn nếu đại ca đã xóa banner)
                updateStatusBanner("Hệ thống ZeroEnglish đã kết nối. Trợ lý AI học thuật sẵn sàng.", false);
            } else {
                // Sửa thông báo lỗi mất key AI
                updateStatusBanner("Hệ thống AI đang bảo trì. Các tính năng luyện tập tiêu chuẩn vẫn hoạt động bình thường.", true);
            }
        } catch (error) {
            // Sửa thông báo khi web bị mất kết nối hoàn toàn
            updateStatusBanner("Không thể kết nối đến máy chủ học thuật. Vui lòng kiểm tra lại đường truyền internet của bạn.", true);
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