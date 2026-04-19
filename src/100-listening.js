    function renderListeningQuestions() {
        clearNode(refs.quizContainer);
        state.currentListening.questions.forEach((question, questionIndex) => {
            const card = createElement("article", "quiz-card");
            card.appendChild(createElement("h4", "", `Câu ${questionIndex + 1}: ${question.q}`));
            question.options.forEach((option, optionIndex) => {
                const label = createElement("label", "quiz-option-label");
                const input = document.createElement("input");
                input.type = "radio";
                input.name = `question-${questionIndex}`;
                input.value = String(optionIndex);
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${option}`));
                card.appendChild(label);
            });
            refs.quizContainer.appendChild(card);
        });
    }

    // Promise-based: chờ voices load xong mới resolve (fix getVoices trả [] lần đầu)
    function waitForVoices() {
        return new Promise((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) { resolve(voices); return; }
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
            };
        });
    }

    function buildUtterance(transcript, level, voices) {
        if (!window.speechSynthesis) return null;
        const utterance = new SpeechSynthesisUtterance(transcript);
        utterance.lang = "en-US";
        utterance.rate = level === "easy" ? 0.82 : level === "medium" ? 0.95 : 1.04;
        if (voices && voices.length > 0) {
            const enVoice = voices.find(v => v.lang === "en-US") || voices.find(v => v.lang.startsWith("en"));
            if (enVoice) utterance.voice = enVoice;
        }
        return utterance;
    }

    async function handleListeningGeneration() {
        if (!state.bootstrap.aiEnabled) {
            showError("Tính năng Luyện nghe yêu cầu AI. Vui lòng cấu hình GROQ_API_KEY.");
            return;
        }
        setBusy(refs.generateListenBtn, true, "Đang tạo...");
        show(refs.listenLoadingMsg);
        hide(refs.listeningBox);
        hide(refs.quizResult);
        hide(refs.showTranscriptBtn);
        hide(refs.transcriptBox);
        refs.submitQuizBtn.disabled = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        try {
            const level = refs.listenLevelSelect.value;
            const data = await api.generateListening(level);

            if (!data.transcript || !Array.isArray(data.questions) || data.questions.length === 0) {
                throw new Error("AI trả về bài nghe không hợp lệ. Vui lòng thử lại.");
            }

            state.currentListening.transcript = data.transcript;
            state.currentListening.questions = data.questions;
            state.currentListening.utterance = buildUtterance(data.transcript, level);
            refs.transcriptBox.textContent = data.transcript;
            renderListeningQuestions();
            show(refs.listeningBox);
        } catch (error) {
            showError(error.message || "Lỗi kết nối AI. Vui lòng thử lại sau.");
        } finally {
            setBusy(refs.generateListenBtn, false, "Đang tạo...");
            hide(refs.listenLoadingMsg);
        }
    }

    function handleSubmitQuiz() {
        if (!state.currentListening.questions.length) return;
        let score = 0;
        state.currentListening.questions.forEach((question, questionIndex) => {
            const checked = refs.quizContainer.querySelector(`input[name="question-${questionIndex}"]:checked`);
            const options = refs.quizContainer.querySelectorAll(`input[name="question-${questionIndex}"]`);
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
        refs.quizResult.textContent = `Bạn đúng ${score} / ${state.currentListening.questions.length} câu.`;
        refs.quizResult.style.background = score === state.currentListening.questions.length
            ? "rgba(30, 143, 98, 0.14)" : "rgba(212, 138, 18, 0.18)";
        refs.quizResult.style.color = score === state.currentListening.questions.length ? "#116241" : "#8e5d09";
        show(refs.quizResult);
        show(refs.showTranscriptBtn);
        refs.submitQuizBtn.disabled = true;
    }

    async function handlePlayAudio() {
        if (!state.currentListening.transcript || !window.speechSynthesis) {
            showError("Chưa có đoạn nghe. Vui lòng tạo bài trước.");
            return;
        }
        if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); return; }
        window.speechSynthesis.cancel();
        const level = refs.listenLevelSelect ? refs.listenLevelSelect.value : "medium";
        // Chờ voices load xong rồi mới build utterance (fix getVoices trả [] lần đầu)
        const voices = await waitForVoices();
        const freshUtterance = buildUtterance(state.currentListening.transcript, level, voices);
        if (freshUtterance) window.speechSynthesis.speak(freshUtterance);
    }

    function initListening() {
        refs.generateListenBtn.addEventListener("click", handleListeningGeneration);
        refs.submitQuizBtn.addEventListener("click", handleSubmitQuiz);
        refs.playAudioBtn.addEventListener("click", handlePlayAudio);
        refs.pauseAudioBtn.addEventListener("click", () => {
            if (window.speechSynthesis) window.speechSynthesis.pause();
        });
        refs.stopAudioBtn.addEventListener("click", () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        });
        refs.showTranscriptBtn.addEventListener("click", () => {
            refs.transcriptBox.classList.toggle("hidden");
            refs.showTranscriptBtn.textContent = refs.transcriptBox.classList.contains("hidden")
                ? "Xem lời thoại" : "Ẩn lời thoại";
        });
    }
