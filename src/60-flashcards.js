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
        refs.saveWordBtn.textContent = isSavedWord(currentWord) ? "Hủy lưu thuật ngữ" : "Lưu thuật ngữ";
    }

    function resetFlashcardFlip() {
        // 1. Dùng setProperty kèm '!important' để bóp nghẹt hoàn toàn hiệu ứng CSS
        refs.flashcard.style.setProperty('transition', 'none', 'important');
        
        // 2. Gỡ class lật, đưa thẻ về mặt trước ngay trong chớp mắt
        refs.flashcard.classList.remove("is-flipped");
        
        // 3. Ép trình duyệt chốt ngay trạng thái không hiệu ứng (Force reflow)
        void refs.flashcard.offsetHeight;
        
        // 4. Cho thời gian chờ dài hơn hẳn (100ms) để chữ mới nạp xong xuôi
        // rồi mới trả lại hiệu ứng xoay để click vào thẻ vẫn lật mượt mà
        setTimeout(() => {
            refs.flashcard.style.transition = '';
        }, 100);
    }
    function stepCard(delta) {
        const wordList = state.appData[state.currentTopic] || [];
        const nextIndex = state.currentIndex + delta;
        
        if (nextIndex < 0 || nextIndex >= wordList.length) return;

        // Reset mặt thẻ về phía trước ngay lập tức TRƯỚC khi đổi dữ liệu
        resetFlashcardFlip();

        state.currentIndex = nextIndex;
        hide(refs.explanationBox);
        refs.explanationText.textContent = "";
        
        // Hiển thị nội dung thẻ mới
        showCard();
    }

    function toggleFlashcard() {
        if (!getCurrentWord()) return;
        // Bật/tắt class lật - CSS sẽ lo phần mượt mà
        refs.flashcard.classList.toggle("is-flipped");
    }

function showCard() {
    const wordList = state.appData[state.currentTopic] || [];
    const item = wordList[state.currentIndex];
    if (!item) return;

    if (state.currentLanguage === 'chinese') {
        // Nạp chữ Hán vào mặt trước
        refs.wordFront.textContent = item.zh; 
        // Nạp Pinyin và Nghĩa vào mặt sau
        refs.wordBack.innerHTML = `
            <div class="pinyin">${item.pro}</div>
            <div class="meaning">${item.vi}</div>
            <div class="example">${item.ex}</div>
        `;
    } else {
        // Tiếng Anh làm tương tự
        refs.wordFront.textContent = item.en;
        refs.wordBack.textContent = item.vi;
    }
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
        if (!state.appData[topicName]) return;
        state.currentTopic = topicName;
        state.currentIndex = 0;
        resetFlashcardFlip();
        hide(refs.explanationBox);
        refs.explanationText.textContent = "";
        renderTopics();
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

        setBusy(refs.generateBtn, true, "Đang khởi tạo...");
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
        if (!currentWord) return;

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
        // Dùng onclick để đảm bảo không bị chồng chéo sự kiện
        refs.flashcard.onclick = (e) => {
            e.preventDefault();
            toggleFlashcard();
        };

        refs.flashcard.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleFlashcard();
            }
        };

        refs.prevBtn.onclick = () => stepCard(-1);
        refs.nextBtn.onclick = () => stepCard(1);
        refs.generateBtn.onclick = handleTopicGeneration;
        refs.explainGrammarBtn.onclick = handleExplainGrammar;
        
        refs.saveWordBtn.onclick = () => {
            const currentWord = getCurrentWord();
            if (!currentWord) return;
            toggleSavedWord(currentWord);
            updateSaveButton();
            renderSavedWords();
        };

        refs.topicInput.onkeydown = (e) => {
            if (e.key === "Enter" && !refs.generateBtn.disabled) {
                handleTopicGeneration();
            }
        };

        refs.savedWordsGrid.onclick = (e) => {
            const target = e.target.closest("[data-remove-saved-index]");
            if (!target) return;
            const index = Number(target.dataset.removeSavedIndex);
            if (Number.isNaN(index)) return;
            state.savedWordsList.splice(index, 1);
            persistSavedWords();
            renderSavedWords();
            updateSaveButton();
        };

        refs.clearSavedBtn.onclick = () => {
            if (!state.savedWordsList.length) return;
            if (!window.confirm("Xác nhận làm sạch toàn bộ Sổ tay thuật ngữ?")) return;
            state.savedWordsList = [];
            persistSavedWords();
            renderSavedWords();
            updateSaveButton();
        };

        renderTopics();
        renderSavedWords();
        const topics = Object.keys(state.appData);
        if (topics.length) loadTopic(topics[0]); else showCard();
    }