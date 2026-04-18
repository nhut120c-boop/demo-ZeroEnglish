    function updateMatchingProgress() {
        refs.matchingProgressText.textContent = `${state.matching.matchedIds.size} / ${state.matching.pairs.length} cặp đúng`;
    }

    function setMatchingFeedback(message, type) {
        refs.matchingFeedback.textContent = message;
        refs.matchingFeedback.classList.remove("success", "error");
        if (type === "success" || type === "error") refs.matchingFeedback.classList.add(type);
    }

    function getPairById(pairId) {
        return state.matching.pairs.find((pair) => pair.id === pairId) || null;
    }

    function renderMatchingColumn(container, side, order) {
        clearNode(container);
        order.forEach((pairId) => {
            const pair = getPairById(pairId);
            if (!pair) return;
            const button = createElement("button", "matching-option", side === "en" ? pair.en : pair.vi);
            button.type = "button";
            button.dataset.side = side;
            button.dataset.id = String(pair.id);
            if (state.matching.selected[side] === pair.id) button.classList.add("is-selected");
            if (state.matching.matchedIds.has(pair.id)) {
                button.classList.add("is-matched");
                button.disabled = true;
            }
            container.appendChild(button);
        });
    }

    function renderMatchingBoard() {
        if (!state.matching.pairs.length) { hide(refs.matchingBox); return; }
        renderMatchingColumn(refs.matchingEnList, "en", state.matching.enOrder);
        renderMatchingColumn(refs.matchingViList, "vi", state.matching.viOrder);
        updateMatchingProgress();
        show(refs.matchingBox);
    }

    function evaluateMatchingSelection() {
        const selectedEnglish = state.matching.selected.en;
        const selectedVietnamese = state.matching.selected.vi;
        if (!selectedEnglish || !selectedVietnamese) return;

        if (selectedEnglish === selectedVietnamese) {
            const pair = getPairById(selectedEnglish);
            state.matching.matchedIds.add(selectedEnglish);
            state.matching.selected = { en: null, vi: null };
            renderMatchingBoard();
            if (state.matching.matchedIds.size === state.matching.pairs.length) {
                setMatchingFeedback("Hoàn thành rồi. Bạn đã ghép đúng toàn bộ bộ từ.", "success");
            } else {
                setMatchingFeedback(`Chính xác: ${pair.en} = ${pair.vi}`, "success");
            }
            return;
        }

        const wrongEn = getPairById(selectedEnglish);
        const wrongVi = getPairById(selectedVietnamese);
        state.matching.selected = { en: null, vi: null };
        renderMatchingBoard();
        setMatchingFeedback(
            `Chưa đúng: "${wrongEn?.en || "từ"}" chưa ghép với "${wrongVi?.vi || "nghĩa"}".`,
            "error",
        );
    }

    function handleMatchingPick(side, pairId) {
        if (state.matching.matchedIds.has(pairId)) return;
        state.matching.selected[side] = state.matching.selected[side] === pairId ? null : pairId;
        renderMatchingBoard();
        evaluateMatchingSelection();
    }

    function seedMatchingBoard(pairs, source) {
        state.matching.pairs = pairs;
        state.matching.enOrder = shuffle(pairs.map((p) => p.id));
        state.matching.viOrder = shuffle(pairs.map((p) => p.id));
        state.matching.matchedIds = new Set();
        state.matching.selected = { en: null, vi: null };
        state.matching.lastSource = source;
        renderMatchingBoard();
        if (source === "fallback") {
            setMatchingFeedback("AI chưa bật nên đang dùng bộ ghép từ an toàn có sẵn.", "");
        } else {
            setMatchingFeedback("Bộ ghép từ AI đã sẵn sàng. Chọn 1 từ tiếng Anh và 1 nghĩa tiếng Việt.", "");
        }
    }

    const MATCHING_FALLBACK = {
        easy: [
            { id:1, en:"apple", vi:"quả táo" }, { id:2, en:"water", vi:"nước" },
            { id:3, en:"book", vi:"quyển sách" }, { id:4, en:"house", vi:"ngôi nhà" },
            { id:5, en:"friend", vi:"bạn bè" }, { id:6, en:"school", vi:"trường học" },
        ],
        medium: [
            { id:1, en:"deadline", vi:"hạn chót" }, { id:2, en:"meeting", vi:"cuộc họp" },
            { id:3, en:"journey", vi:"hành trình" }, { id:4, en:"improve", vi:"cải thiện" },
            { id:5, en:"decision", vi:"quyết định" }, { id:6, en:"practice", vi:"luyện tập" },
            { id:7, en:"support", vi:"hỗ trợ" }, { id:8, en:"project", vi:"dự án" },
        ],
        hard: [
            { id:1, en:"resilient", vi:"kiên cường" }, { id:2, en:"perspective", vi:"góc nhìn" },
            { id:3, en:"sustainable", vi:"bền vững" }, { id:4, en:"compliance", vi:"sự tuân thủ" },
            { id:5, en:"vulnerable", vi:"dễ bị tổn thương" }, { id:6, en:"negotiate", vi:"đàm phán" },
            { id:7, en:"misleading", vi:"gây hiểu lầm" }, { id:8, en:"constraint", vi:"ràng buộc" },
            { id:9, en:"scalable", vi:"có thể mở rộng" }, { id:10, en:"transparent", vi:"minh bạch" },
        ],
    };

    async function handleMatchingGeneration() {
        setBusy(refs.generateMatchingBtn, true, "Đang tạo...");
        show(refs.matchingLoadingMsg);

        try {
            const level = refs.matchingLevelSelect.value;
            state.matching.level = level;

            if (!state.bootstrap.aiEnabled) {
                const fallback = MATCHING_FALLBACK[level] || MATCHING_FALLBACK.easy;
                seedMatchingBoard(fallback, "fallback");
                return;
            }

            try {
                const data = await api.generateMatching(level);
                const pairs = Array.isArray(data.pairs) && data.pairs.length >= 4 ? data.pairs : null;
                if (pairs) {
                    seedMatchingBoard(pairs, data.source || "ai");
                } else {
                    throw new Error("AI trả về dữ liệu không đủ.");
                }
            } catch {
                const fallback = MATCHING_FALLBACK[level] || MATCHING_FALLBACK.easy;
                seedMatchingBoard(fallback, "fallback");
            }
        } catch (error) {
            showError(error.message || "Lỗi khi tải bộ ghép từ.");
        } finally {
            setBusy(refs.generateMatchingBtn, false, "Đang tạo...");
            hide(refs.matchingLoadingMsg);
        }
    }

    function initMatching() {
        refs.generateMatchingBtn.addEventListener("click", handleMatchingGeneration);
        refs.resetMatchingBtn.addEventListener("click", () => {
            if (!state.matching.pairs.length) return;
            state.matching.enOrder = shuffle(state.matching.enOrder);
            state.matching.viOrder = shuffle(state.matching.viOrder);
            state.matching.selected = { en: null, vi: null };
            renderMatchingBoard();
            setMatchingFeedback("Đã trộn lại các lựa chọn.", "");
        });
        refs.matchingEnList.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-side='en']");
            if (!target) return;
            handleMatchingPick("en", Number(target.dataset.id));
        });
        refs.matchingViList.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-side='vi']");
            if (!target) return;
            handleMatchingPick("vi", Number(target.dataset.id));
        });
    }
