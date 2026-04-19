    // ============================================================
    // CHINESE MODE - src/cn-flashcards.js
    // Mirrors English flashcard logic but for Mandarin data
    // ============================================================

    function setChineseFlashcardVisibility(hasWord) {
        [refs.cnCardContainer, refs.cnActionButtons, refs.cnControls].forEach((el) => {
            if (hasWord) { show(el); } else { hide(el); }
        });
    }

    function updateChineseSaveButton() {
        const word = getCurrentChineseWord();
        if (!word) { refs.cnSaveWordBtn.textContent = "Lưu từ"; return; }
        refs.cnSaveWordBtn.textContent = isSavedChineseWord(word) ? "Hủy lưu từ" : "Lưu từ";
    }

    function renderChineseCard() {
        const word = getCurrentChineseWord();
        if (!word) {
            setChineseFlashcardVisibility(false);
            show(refs.cnFlashcardPlaceholder);
            hide(refs.cnFlashcardHeader);
            return;
        }
        hide(refs.cnFlashcardPlaceholder);
        show(refs.cnFlashcardHeader);
        setChineseFlashcardVisibility(true);

        const list = state.cnAppData[state.cnCurrentTopic] || [];
        refs.cnProgressText.textContent = `${state.cnCurrentIndex + 1} / ${list.length}`;
        refs.cnCurrentTopicTitle.textContent = state.cnCurrentTopic;
        refs.cnWordZh.textContent = word.zh;
        refs.cnWordPro.textContent = word.pro;
        refs.cnWordVi.textContent = word.vi;
        refs.cnWordEx.textContent = word.ex;

        refs.cnFlashcard.classList.remove("is-flipped");
        refs.cnExplanationBox.classList.add("hidden");
        updateChineseSaveButton();
    }

    function stepChineseCard(delta) {
        const list = state.cnAppData[state.cnCurrentTopic] || [];
        const next = state.cnCurrentIndex + delta;
        if (next < 0 || next >= list.length) return;
        state.cnCurrentIndex = next;
        renderChineseCard();
    }

    function renderChineseTopicList() {
        clearNode(refs.cnTopicList);
        Object.keys(state.cnAppData).forEach((topicName) => {
            const li = createElement("li", "topic-item");
            const btn = createElement("button", "topic-btn", topicName);
            btn.type = "button";
            btn.addEventListener("click", () => {
                state.cnCurrentTopic = topicName;
                state.cnCurrentIndex = 0;
                renderChineseTopicList();
                renderChineseCard();
            });
            if (state.cnCurrentTopic === topicName) {
                btn.classList.add("active");
            }
            li.appendChild(btn);
            refs.cnTopicList.appendChild(li);
        });
    }

    async function handleChineseTopicGenerate() {
        const topic = refs.cnTopicInput.value.trim();
        if (!topic) { showError("Vui lòng nhập chủ đề tiếng Trung."); return; }
        if (!state.bootstrap.aiEnabled) { showError("AI chưa được bật. Không thể tạo chủ đề mới."); return; }

        setBusy(refs.cnGenerateBtn, true, "Đang tạo...");
        show(refs.cnLoadingMsg);
        try {
            const data = await api.generateChineseTopic(topic);
            state.cnAppData[data.topic] = data.words;
            persistChineseTopics();
            state.cnCurrentTopic = data.topic;
            state.cnCurrentIndex = 0;
            renderChineseTopicList();
            renderChineseCard();
            refs.cnTopicInput.value = "";
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.cnGenerateBtn, false, "Đang tạo...");
            hide(refs.cnLoadingMsg);
        }
    }

    function initChineseFlashcards() {
        refs.cnGenerateBtn.addEventListener("click", handleChineseTopicGenerate);
        refs.cnFlashcard.addEventListener("click", () => refs.cnFlashcard.classList.toggle("is-flipped"));
        refs.cnPrevBtn.addEventListener("click", () => stepChineseCard(-1));
        refs.cnNextBtn.addEventListener("click", () => stepChineseCard(1));

        refs.cnSaveWordBtn.addEventListener("click", () => {
            const word = getCurrentChineseWord();
            if (!word) return;
            toggleSavedChineseWord(word);
            updateChineseSaveButton();
        });

        refs.cnExplainBtn.addEventListener("click", async () => {
            const word = getCurrentChineseWord();
            if (!word) return;
            setBusy(refs.cnExplainBtn, true, "Đang phân tích...");
            try {
                const data = await api.explainChineseSentence(word.ex);
                refs.cnExplanationText.textContent = data.explanation;
                refs.cnExplanationBox.classList.remove("hidden");
            } catch (error) {
                showError(error.message);
            } finally {
                setBusy(refs.cnExplainBtn, false, "Đang phân tích...");
            }
        });

        renderChineseTopicList();
        if (state.cnCurrentTopic) {
            renderChineseCard();
        }
    }

    // ============================================================
    // CHINESE READING
    // ============================================================

    function renderChineseReadingContent(content) {
        clearNode(refs.cnReadingContent);
        const tokens = content.split(/\s+/).filter(Boolean);
        tokens.forEach((token, index) => {
            const span = createElement("span", "", token);
            span.dataset.word = normalizeLookupKey(token);
            refs.cnReadingContent.appendChild(span);
            if (index < tokens.length - 1) {
                refs.cnReadingContent.appendChild(document.createTextNode(" "));
            }
        });
    }

    async function handleChineseReadingGeneration() {
        setBusy(refs.cnGenerateReadingBtn, true, "Đang tạo...");
        show(refs.cnReadingLoadingMsg);
        hide(refs.cnReadingBox);
        hide(refs.cnFullTranslationBox);

        try {
            const data = await api.generateChineseReading(refs.cnLevelSelect.value);
            state.cnCurrentReadingVocab = data.vocab || {};
            refs.cnReadingTitle.textContent = data.title;
            refs.cnFullTranslationBox.textContent = data.translation;
            refs.cnToggleTranslationBtn.textContent = "Xem bản dịch đầy đủ";
            renderChineseReadingContent(data.content);
            show(refs.cnReadingBox);
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.cnGenerateReadingBtn, false, "Đang tạo...");
            hide(refs.cnReadingLoadingMsg);
        }
    }

    function initChineseReading() {
        refs.cnGenerateReadingBtn.addEventListener("click", handleChineseReadingGeneration);
        refs.cnReadingContent.addEventListener("click", (event) => {
            const target = event.target.closest("span[data-word]");
            if (!target) return;
            const key = target.dataset.word || normalizeLookupKey(target.textContent);
            const meaning = state.cnCurrentReadingVocab[key] || "Chưa có nghĩa cho từ này.";
            refs.tooltip.textContent = meaning;
            show(refs.tooltip);
            requestAnimationFrame(() => {
                const rect = target.getBoundingClientRect();
                refs.tooltip.style.left = `${window.scrollX + rect.left + rect.width / 2 - refs.tooltip.offsetWidth / 2}px`;
                refs.tooltip.style.top = `${window.scrollY + rect.top - refs.tooltip.offsetHeight - 12}px`;
            });
        });
        refs.cnToggleTranslationBtn.addEventListener("click", () => {
            refs.cnFullTranslationBox.classList.toggle("hidden");
            refs.cnToggleTranslationBtn.textContent = refs.cnFullTranslationBox.classList.contains("hidden")
                ? "Xem bản dịch đầy đủ" : "Ẩn bản dịch";
        });
        document.addEventListener("click", (event) => {
            if (!event.target.closest("#cnReadingContent span")) hide(refs.tooltip);
        });
    }

    // ============================================================
    // CHINESE LISTENING
    // ============================================================

    function renderChineseListeningQuestions() {
        clearNode(refs.cnQuizContainer);
        state.cnCurrentListening.questions.forEach((question, questionIndex) => {
            const card = createElement("article", "quiz-card");
            card.appendChild(createElement("h4", "", `Câu ${questionIndex + 1}: ${question.q}`));
            question.options.forEach((option, optionIndex) => {
                const label = createElement("label", "quiz-option-label");
                const input = document.createElement("input");
                input.type = "radio";
                input.name = `cn-question-${questionIndex}`;
                input.value = String(optionIndex);
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${option}`));
                card.appendChild(label);
            });
            refs.cnQuizContainer.appendChild(card);
        });
    }

    function buildChineseUtterance(transcript, level, voices) {
        if (!window.speechSynthesis) return null;
        const utterance = new SpeechSynthesisUtterance(transcript);
        utterance.lang = "zh-CN";
        utterance.rate = level === "easy" ? 0.75 : 0.9;
        if (voices && voices.length > 0) {
            const zhVoice = voices.find(v => v.lang === "zh-CN")
                || voices.find(v => v.lang === "zh-TW")
                || voices.find(v => v.lang.startsWith("zh"));
            if (zhVoice) utterance.voice = zhVoice;
        }
        return utterance;
    }

    async function handleChineseListeningGeneration() {
        setBusy(refs.cnGenerateListenBtn, true, "Đang tạo...");
        show(refs.cnListenLoadingMsg);
        hide(refs.cnListeningBox);
        hide(refs.cnQuizResult);
        hide(refs.cnShowTranscriptBtn);
        hide(refs.cnTranscriptBox);
        refs.cnSubmitQuizBtn.disabled = false;

        if (window.speechSynthesis) window.speechSynthesis.cancel();

        try {
            const level = refs.cnListenLevelSelect.value;
            const data = await api.generateChineseListening(level);
            state.cnCurrentListening.transcript = data.transcript;
            state.cnCurrentListening.questions = data.questions;
            state.cnCurrentListening.level = level;

            // Lưu level để rebuild utterance mỗi lần play
            refs.cnTranscriptBox.textContent = data.transcript;
            renderChineseListeningQuestions();
            show(refs.cnListeningBox);
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.cnGenerateListenBtn, false, "Đang tạo...");
            hide(refs.cnListenLoadingMsg);
        }
    }

    function handleChineseSubmitQuiz() {
        if (!state.cnCurrentListening.questions.length) return;
        let score = 0;
        state.cnCurrentListening.questions.forEach((question, questionIndex) => {
            const checked = refs.cnQuizContainer.querySelector(`input[name="cn-question-${questionIndex}"]:checked`);
            const options = refs.cnQuizContainer.querySelectorAll(`input[name="cn-question-${questionIndex}"]`);
            options.forEach((input, optionIndex) => {
                const label = input.closest(".quiz-option-label");
                label.classList.remove("option-correct", "option-wrong");
                if (optionIndex === question.answerIndex) label.classList.add("option-correct");
                if (checked && Number(checked.value) === optionIndex && optionIndex !== question.answerIndex) {
                    label.classList.add("option-wrong");
                }
            });
            if (checked && Number(checked.value) === question.answerIndex) score += 1;
        });
        refs.cnQuizResult.textContent = `Bạn đúng ${score} / ${state.cnCurrentListening.questions.length} câu.`;
        refs.cnQuizResult.style.background = score === state.cnCurrentListening.questions.length
            ? "rgba(30, 143, 98, 0.14)" : "rgba(212, 138, 18, 0.18)";
        refs.cnQuizResult.style.color = score === state.cnCurrentListening.questions.length ? "#116241" : "#8e5d09";
        show(refs.cnQuizResult);
        show(refs.cnShowTranscriptBtn);
        refs.cnSubmitQuizBtn.disabled = true;
    }

    function initChineseListening() {
        refs.cnGenerateListenBtn.addEventListener("click", handleChineseListeningGeneration);
        refs.cnSubmitQuizBtn.addEventListener("click", handleChineseSubmitQuiz);
        refs.cnPlayAudioBtn.addEventListener("click", async () => {
            if (!state.cnCurrentListening.transcript || !window.speechSynthesis) {
                showError("Chưa có đoạn nghe để phát."); return;
            }
            if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); return; }
            window.speechSynthesis.cancel();
            const level = state.cnCurrentListening.level || "medium";
            // Chờ voices load xong (fix mobile: getVoices trả [] lần đầu)
            const voices = await waitForVoices();
            const freshUtterance = buildChineseUtterance(state.cnCurrentListening.transcript, level, voices);
            if (freshUtterance) window.speechSynthesis.speak(freshUtterance);
        });
        refs.cnStopAudioBtn.addEventListener("click", () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        });
        refs.cnShowTranscriptBtn.addEventListener("click", () => {
            refs.cnTranscriptBox.classList.toggle("hidden");
            refs.cnShowTranscriptBtn.textContent = refs.cnTranscriptBox.classList.contains("hidden")
                ? "Xem lời thoại" : "Ẩn lời thoại";
        });
    }

    // ============================================================
    // CHINESE MATCHING
    // ============================================================

    const CHINESE_MATCHING_FALLBACK = {
        easy: [
            { zh: "你好", vi: "Xin chào" }, { zh: "谢谢", vi: "Cảm ơn" },
            { zh: "再见", vi: "Tạm biệt" }, { zh: "吃饭", vi: "Ăn cơm" },
            { zh: "学习", vi: "Học tập" }, { zh: "朋友", vi: "Bạn bè" },
        ],
        medium: [
            { zh: "工作", vi: "Công việc" }, { zh: "问题", vi: "Vấn đề" },
            { zh: "时间", vi: "Thời gian" }, { zh: "城市", vi: "Thành phố" },
            { zh: "文化", vi: "Văn hóa" }, { zh: "旅游", vi: "Du lịch" },
            { zh: "经验", vi: "Kinh nghiệm" }, { zh: "发展", vi: "Phát triển" },
        ],
        hard: [
            { zh: "可持续", vi: "Bền vững" }, { zh: "透明度", vi: "Sự minh bạch" },
            { zh: "竞争力", vi: "Năng lực cạnh tranh" }, { zh: "创新", vi: "Sáng tạo" },
            { zh: "效率", vi: "Hiệu quả" }, { zh: "挑战", vi: "Thách thức" },
            { zh: "机遇", vi: "Cơ hội" }, { zh: "战略", vi: "Chiến lược" },
            { zh: "合作", vi: "Hợp tác" }, { zh: "影响", vi: "Ảnh hưởng" },
        ],
    };

    function renderChineseMatchingColumn(container, side, order) {
        clearNode(container);
        order.forEach((pairId) => {
            const pair = state.cnMatching.pairs.find((p) => p.id === pairId);
            if (!pair) return;
            const button = createElement("button", "matching-option", side === "zh" ? pair.zh : pair.vi);
            button.type = "button";
            button.dataset.side = side;
            button.dataset.id = String(pair.id);
            if (state.cnMatching.selected[side] === pair.id) button.classList.add("is-selected");
            if (state.cnMatching.matchedIds.has(pair.id)) {
                button.classList.add("is-matched");
                button.disabled = true;
            }
            container.appendChild(button);
        });
    }

    function renderChineseMatchingBoard() {
        if (!state.cnMatching.pairs.length) { hide(refs.cnMatchingBox); return; }
        renderChineseMatchingColumn(refs.cnMatchingZhList, "zh", state.cnMatching.zhOrder);
        renderChineseMatchingColumn(refs.cnMatchingViList, "vi", state.cnMatching.viOrder);
        refs.cnMatchingProgressText.textContent = `${state.cnMatching.matchedIds.size} / ${state.cnMatching.pairs.length} cặp đúng`;
        show(refs.cnMatchingBox);
    }

    function evaluateChineseMatchingSelection() {
        const selZh = state.cnMatching.selected.zh;
        const selVi = state.cnMatching.selected.vi;
        if (!selZh || !selVi) return;

        if (selZh === selVi) {
            const pair = state.cnMatching.pairs.find((p) => p.id === selZh);
            state.cnMatching.matchedIds.add(selZh);
            state.cnMatching.selected = { zh: null, vi: null };
            renderChineseMatchingBoard();
            refs.cnMatchingFeedback.className = "matching-feedback success";
            if (state.cnMatching.matchedIds.size === state.cnMatching.pairs.length) {
                refs.cnMatchingFeedback.textContent = "Hoàn thành rồi! Bạn đã ghép đúng toàn bộ bộ từ.";
            } else {
                refs.cnMatchingFeedback.textContent = `Chính xác: ${pair.zh} = ${pair.vi}`;
            }
            return;
        }

        const wrongZh = state.cnMatching.pairs.find((p) => p.id === selZh);
        const wrongVi = state.cnMatching.pairs.find((p) => p.id === selVi);
        state.cnMatching.selected = { zh: null, vi: null };
        renderChineseMatchingBoard();
        refs.cnMatchingFeedback.className = "matching-feedback error";
        refs.cnMatchingFeedback.textContent = `Chưa đúng: "${wrongZh?.zh || "từ"}" chưa khớp với "${wrongVi?.vi || "nghĩa"}".`;
    }

    async function handleChineseMatchingGeneration() {
        setBusy(refs.cnGenerateMatchingBtn, true, "Đang tạo...");
        show(refs.cnMatchingLoadingMsg);

        try {
            const level = refs.cnMatchingLevelSelect.value;
            state.cnMatching.level = level;

            let pairs;
            let source;
            if (state.bootstrap.aiEnabled) {
                try {
                    const data = await api.generateChineseMatching(level);
                    pairs = Array.isArray(data.pairs) ? data.pairs : [];
                    source = data.source || "ai";
                } catch {
                    pairs = null;
                }
            }

            if (!pairs || pairs.length < 4) {
                const fallback = CHINESE_MATCHING_FALLBACK[level] || CHINESE_MATCHING_FALLBACK.easy;
                pairs = fallback.map((p, i) => ({ id: i + 1, zh: p.zh, vi: p.vi }));
                source = "fallback";
            }

            state.cnMatching.pairs = pairs;
            state.cnMatching.zhOrder = shuffle(pairs.map((p) => p.id));
            state.cnMatching.viOrder = shuffle(pairs.map((p) => p.id));
            state.cnMatching.matchedIds = new Set();
            state.cnMatching.selected = { zh: null, vi: null };
            renderChineseMatchingBoard();
            refs.cnMatchingFeedback.className = "matching-feedback";
            refs.cnMatchingFeedback.textContent = source === "fallback"
                ? "AI chưa bật nên đang dùng bộ ghép từ có sẵn."
                : "Bộ ghép từ AI đã sẵn sàng. Chọn 1 từ Hán và 1 nghĩa tiếng Việt.";
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.cnGenerateMatchingBtn, false, "Đang tạo...");
            hide(refs.cnMatchingLoadingMsg);
        }
    }

    function initChineseMatching() {
        refs.cnGenerateMatchingBtn.addEventListener("click", handleChineseMatchingGeneration);
        refs.cnResetMatchingBtn.addEventListener("click", () => {
            if (!state.cnMatching.pairs.length) return;
            state.cnMatching.zhOrder = shuffle(state.cnMatching.zhOrder);
            state.cnMatching.viOrder = shuffle(state.cnMatching.viOrder);
            state.cnMatching.selected = { zh: null, vi: null };
            renderChineseMatchingBoard();
            refs.cnMatchingFeedback.className = "matching-feedback";
            refs.cnMatchingFeedback.textContent = "Đã trộn lại các lựa chọn.";
        });
        refs.cnMatchingZhList.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-side='zh']");
            if (!target) return;
            const pairId = Number(target.dataset.id);
            if (state.cnMatching.matchedIds.has(pairId)) return;
            state.cnMatching.selected.zh = state.cnMatching.selected.zh === pairId ? null : pairId;
            renderChineseMatchingBoard();
            evaluateChineseMatchingSelection();
        });
        refs.cnMatchingViList.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-side='vi']");
            if (!target) return;
            const pairId = Number(target.dataset.id);
            if (state.cnMatching.matchedIds.has(pairId)) return;
            state.cnMatching.selected.vi = state.cnMatching.selected.vi === pairId ? null : pairId;
            renderChineseMatchingBoard();
            evaluateChineseMatchingSelection();
        });
    }

    // ============================================================
    // CHINESE SAVED WORDS
    // ============================================================

    function renderChineseSavedWords() {
        clearNode(refs.cnSavedWordsGrid);
        if (!state.cnSavedWordsList.length) {
            refs.cnSavedWordsGrid.innerHTML = "<p style='color:var(--text-muted);padding:1rem;'>Chưa có từ nào được lưu.</p>";
            return;
        }
        state.cnSavedWordsList.forEach((word) => {
            const card = createElement("div", "saved-word-card");
            card.innerHTML = `<span class="saved-zh">${word.zh}</span><span class="saved-pro">${word.pro}</span><span class="saved-vi">${word.vi}</span><span class="saved-ex">${word.ex}</span>`;
            refs.cnSavedWordsGrid.appendChild(card);
        });
    }

    function initChineseSaved() {
        refs.cnClearSavedBtn.addEventListener("click", () => {
            if (!state.cnSavedWordsList.length) return;
            if (!confirm("Xóa toàn bộ sổ tay tiếng Trung?")) return;
            state.cnSavedWordsList = [];
            persistChineseSavedWords();
            renderChineseSavedWords();
        });
    }

    function initChinese() {
        initChineseFlashcards();
        initChineseReading();
        initChineseListening();
        initChineseMatching();
        initChineseSaved();
    }
