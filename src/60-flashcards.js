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
            refs.saveWordBtn.textContent = "Lưu từ này";
            return;
        }

        refs.saveWordBtn.textContent = isSavedWord(currentWord) ? "Bỏ lưu từ này" : "Lưu từ này";
    }

    function showCard() {
        const currentWord = getCurrentWord();
        if (!currentWord) {
            refs.currentTopicTitle.textContent = "Chọn một chủ đề để bắt đầu";
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
            refs.topicList.appendChild(createElement("li", "", "Chưa có chủ đề nào."));
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
        refs.flashcard.classList.remove("is-flipped");
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
        refs.flashcard.classList.remove("is-flipped");
        hide(refs.explanationBox);
        refs.explanationText.textContent = "";
        showCard();
    }

    async function handleTopicGeneration() {
        const topic = refs.topicInput.value.trim();
        if (!topic) {
            showError("Hãy nhập tên chủ đề trước.");
            return;
        }
        if (state.appData[topic]) {
            showError("Chủ đề này đã tồn tại rồi.");
            return;
        }

        setBusy(refs.generateBtn, true, "Đang tạo...");
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
            setBusy(refs.generateBtn, false, "Đang tạo...");
            hide(refs.loadingMsg);
        }
    }

    async function handleExplainGrammar() {
        const currentWord = getCurrentWord();
        if (!currentWord) {
            return;
        }

        refs.explanationText.textContent = "Đang phân tích câu ví dụ...";
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
            refs.savedWordsGrid.appendChild(createElement("p", "", "Chưa có từ nào được lưu."));
            return;
        }

        state.savedWordsList.forEach((word, index) => {
            const card = createElement("article", "saved-card");
            const title = createElement("h3", "", word.en);
            const meaning = createElement("p", "", `Nghĩa: ${word.vi}`);
            const example = createElement("p", "", `Ví dụ: ${word.ex}`);
            const removeButton = createElement("button", "btn-secondary remove-btn", "Xóa khỏi sổ tay");
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
        refs.flashcard.addEventListener("click", () => {
            if (getCurrentWord()) {
                refs.flashcard.classList.toggle("is-flipped");
            }
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
            if (!window.confirm("Bạn muốn xóa toàn bộ từ đã lưu chứ?")) {
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
