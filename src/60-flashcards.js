function setFlashcardVisibility(hasWord) {
        [refs.cardContainer, refs.actionButtons, refs.controls].forEach((element) => {
            if (hasWord) {
                show(element);
            } else {
                hide(element);
            }
        });
    }

    function updateSaveButton() {
        const currentWord = getCurrentWord();
        if (!currentWord) {
            refs.saveWordBtn.textContent = "Lưu thuật ngữ";
            return;
        }

        // Đổi chữ sang phong cách học thuật
        refs.saveWordBtn.textContent = isSavedWord(currentWord) ? "Hủy lưu thuật ngữ" : "Lưu thuật ngữ";
    }

    function resetFlashcardFlip() {
        refs.flashcard.classList.remove("is-flipped");
        refs.flashcard.classList.remove("is-animating");
        state.flashcardInteraction.isAnimating = false;
    }

    function toggleFlashcard() {
        if (!getCurrentWord() || state.flashcardInteraction.isAnimating) {
            return;
        }

        state.flashcardInteraction.isAnimating = true;
        refs.flashcard.classList.add("is-animating");
        refs.flashcard.classList.toggle("is-flipped");

        window.setTimeout(() => {
            refs.flashcard.classList.remove("is-animating");
            state.flashcardInteraction.isAnimating = false;
        }, 420);
    }

    function showCard() {
        const currentWord = getCurrentWord();
        if (!currentWord) {
            refs.currentTopicTitle.textContent = "Vui lòng chọn một chủ đề học thuật";
            refs.progressText.textContent = "0 / 0";
            setFlashcardVisibility(false);
            return;
        }

        const wordList = state.appData[state.currentTopic] || [];
        refs.currentTopicTitle.textContent = state.currentTopic;
        refs.progressText.textContent = `${state.currentIndex + 1} / ${wordList.length}`;
        refs.wordEn.textContent = currentWord.en;
        refs.wordPro.textContent = currentWord.pro || "/.../";
        refs.wordVi.textContent = currentWord.vi;
        refs.wordEx.textContent = currentWord.ex;
        updateSaveButton();
        setFlashcardVisibility(true);
    }

    function renderTopics() {
        clearNode(refs.topicList);
        const topics = Object.keys(state.appData);

        if (!topics.length) {
            refs.topicList.appendChild(createElement("li", "", "Hệ thống chưa có dữ liệu chủ đề."));
            return;
        }

        topics.forEach((topicName) => {
            const listItem = createElement("li");
            const button = createElement("button", "topic-item", topicName);
            button.type = "button";
            if (topicName === state.currentTopic) {
                button.classList.add("active");
            }
            button.addEventListener("click", () => loadTopic(topicName));
            listItem.appendChild(button);
            refs.topicList.appendChild(listItem);
        });
    }

    function loadTopic(topicName) {
        if (!state.appData[topicName]) {
            return;
        }

        state.currentTopic = topicName;
        state.currentIndex = 0;
        resetFlashcardFlip();
        hide(refs.explanationBox);
        refs.explanationText.textContent = "";
        renderTopics();
        showCard();
    }

    function stepCard(delta) {
        const wordList = state.appData[state.currentTopic] || [];
        const nextIndex = state.currentIndex + delta;

        if (nextIndex < 0 || nextIndex >= wordList.length) {
            return;
        }

        state.currentIndex = nextIndex;
        resetFlashcardFlip();
        hide(refs.explanationBox);
        refs.explanationText.textContent = "";
        showCard();
    }

    async function handleTopicGeneration() {
        const topic = refs.topicInput.value.trim();
        if (!topic) {
            showError("Vui lòng nhập từ khóa chủ đề cần tạo.");
            return;
        }
        if (state.appData[topic]) {
            showError("Chủ đề này đã tồn tại trong hệ thống.");
            return;
        }

        setBusy(refs.generateBtn, true, "Đang khởi tạo dữ liệu...");
        show(refs.loadingMsg);

        try {
            const data = await api.generateTopic(topic);
            state.appData[data.topic] = Array.isArray(data.words) ? data.words : [];
            persistCustomTopics();
            refs.topicInput.value = "";
            renderTopics();
            loadTopic(data.topic);
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.generateBtn, false, "Khởi tạo chủ đề AI");
            hide(refs.loadingMsg);
        }
    }

    async function handleExplainGrammar() {
        const currentWord = getCurrentWord();
        if (!currentWord) {
            return;
        }

        refs.explanationText.textContent = "Trợ lý AI đang phân tích cấu trúc ngữ pháp...";
        show(refs.explanationBox);

        try {
            const data = await api.explainSentence(currentWord.ex);
            refs.explanationText.textContent = data.explanation;
        } catch (error) {
            refs.explanationText.textContent = error.message;
        }
    }

    function renderSavedWords() {
        clearNode(refs.savedWordsGrid);

        if (!state.savedWordsList.length) {
            refs.savedWordsGrid.appendChild(createElement("p", "", "Sổ tay thuật ngữ hiện đang trống."));
            return;
        }

        state.savedWordsList.forEach((word, index) => {
            const card = createElement("article", "saved-card");
            const title = createElement("h3", "", word.en);
            const meaning = createElement("p", "", `Định nghĩa: ${word.vi}`);
            const example = createElement("p", "", `Ngữ cảnh: ${word.ex}`);
            const removeButton = createElement("button", "btn-secondary remove-btn", "Loại bỏ");
            removeButton.type = "button";
            removeButton.dataset.removeSavedIndex = String(index);

            card.appendChild(title);
            card.appendChild(meaning);
            card.appendChild(example);
            card.appendChild(removeButton);
            refs.savedWordsGrid.appendChild(card);
        });
    }

    function initFlashcards() {
        // [ĐÃ ĐỘ LẠI]: Bỏ hết pointerdown, pointerup phức tạp. Thay bằng 1 event click cực mượt cho cả Touch và Chuột.
        refs.flashcard.addEventListener("click", (event) => {
            event.preventDefault();
            toggleFlashcard();
        });

        refs.flashcard.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }
            event.preventDefault();
            toggleFlashcard();
        });

        refs.prevBtn.addEventListener("click", () => stepCard(-1));
        refs.nextBtn.addEventListener("click", () => stepCard(1));
        refs.generateBtn.addEventListener("click", handleTopicGeneration);
        refs.explainGrammarBtn.addEventListener("click", handleExplainGrammar);
        refs.saveWordBtn.addEventListener("click", () => {
            const currentWord = getCurrentWord();
            if (!currentWord) {
                return;
            }
            toggleSavedWord(currentWord);
            updateSaveButton();
            renderSavedWords();
        });

        refs.topicInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !refs.generateBtn.disabled) {
                handleTopicGeneration();
            }
        });

        refs.savedWordsGrid.addEventListener("click", (event) => {
            const target = event.target.closest("[data-remove-saved-index]");
            if (!target) {
                return;
            }
            const index = Number(target.dataset.removeSavedIndex);
            if (Number.isNaN(index)) {
                return;
            }
            state.savedWordsList.splice(index, 1);
            persistSavedWords();
            renderSavedWords();
            updateSaveButton();
        });

        refs.clearSavedBtn.addEventListener("click", () => {
            if (!state.savedWordsList.length) {
                return;
            }
            if (!window.confirm("Xác nhận làm sạch toàn bộ dữ liệu trong Sổ tay thuật ngữ?")) {
                return;
            }
            state.savedWordsList = [];
            persistSavedWords();
            renderSavedWords();
            updateSaveButton();
        });

        renderTopics();
        renderSavedWords();
        const topics = Object.keys(state.appData);
        if (topics.length) {
            loadTopic(topics[0]);
        } else {
            showCard();
        }
    }