    function renderReadingContent(content) {
        clearNode(refs.readingContent);
        const tokens = content.split(/\s+/).filter(Boolean);
        tokens.forEach((token, index) => {
            const wordButton = createElement("span", "", token);
            wordButton.dataset.word = normalizeLookupKey(token);
            refs.readingContent.appendChild(wordButton);
            if (index < tokens.length - 1) {
                refs.readingContent.appendChild(document.createTextNode(" "));
            }
        });
    }

    function showTooltipForWord(target) {
        const lookupKey = target.dataset.word || normalizeLookupKey(target.textContent);
        const meaning = state.currentReadingVocab[lookupKey] || "Chưa có nghĩa cho từ này.";
        refs.tooltip.textContent = meaning;
        show(refs.tooltip);
        requestAnimationFrame(() => {
            const rect = target.getBoundingClientRect();
            refs.tooltip.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (refs.tooltip.offsetWidth / 2)}px`;
            refs.tooltip.style.top = `${window.scrollY + rect.top - refs.tooltip.offsetHeight - 12}px`;
        });
    }

    async function handleReadingGeneration() {
        if (!state.bootstrap.aiEnabled) {
            showError("Tính năng Đọc hiểu yêu cầu AI. Vui lòng cấu hình GROQ_API_KEY.");
            return;
        }
        setBusy(refs.generateReadingBtn, true, "Đang tạo...");
        show(refs.readingLoadingMsg);
        hide(refs.readingBox);
        hide(refs.fullTranslationBox);

        try {
            const data = await api.generateReading(refs.levelSelect.value);
            if (!data.content || !data.title) {
                throw new Error("AI trả về bài đọc không hợp lệ. Vui lòng thử lại.");
            }
            state.currentReadingVocab = data.vocab || {};
            refs.readingTitle.textContent = data.title;
            refs.fullTranslationBox.textContent = data.translation;
            refs.toggleTranslationBtn.textContent = "Xem bản dịch đầy đủ";
            renderReadingContent(data.content);
            show(refs.readingBox);
        } catch (error) {
            showError(error.message || "Lỗi kết nối AI. Vui lòng thử lại sau.");
        } finally {
            setBusy(refs.generateReadingBtn, false, "Đang tạo...");
            hide(refs.readingLoadingMsg);
        }
    }

    function initReading() {
        refs.generateReadingBtn.addEventListener("click", handleReadingGeneration);
        refs.readingContent.addEventListener("click", (event) => {
            const target = event.target.closest("span[data-word]");
            if (!target) return;
            showTooltipForWord(target);
        });
        refs.toggleTranslationBtn.addEventListener("click", () => {
            refs.fullTranslationBox.classList.toggle("hidden");
            refs.toggleTranslationBtn.textContent = refs.fullTranslationBox.classList.contains("hidden")
                ? "Xem bản dịch đầy đủ" : "Ẩn bản dịch";
        });
        document.addEventListener("click", (event) => {
            if (!event.target.closest("#readingContent span")) hide(refs.tooltip);
        });
    }
