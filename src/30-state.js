    const baseData = typeof defaultData === "object" && defaultData ? cloneData(defaultData) : {};
    const baseCnData = typeof defaultChineseData === "object" && defaultChineseData ? cloneData(defaultChineseData) : {};
    const savedTopics = safeParse(localStorage.getItem(STORAGE_KEYS.customTopics), {});
    const savedWordsSeed = safeParse(localStorage.getItem(STORAGE_KEYS.savedWords), []);
    const savedCnTopics = safeParse(localStorage.getItem(STORAGE_KEYS.cnCustomTopics), {});
    const savedCnWordsSeed = safeParse(localStorage.getItem(STORAGE_KEYS.cnSavedWords), []);

    const state = {
        bootstrap: {
            brand: BRAND_NAME,
            aiEnabled: false,
            secureMode: false,
        },
        // --- English ---
        appData: Object.assign({}, baseData, savedTopics),
        savedWordsList: Array.isArray(savedWordsSeed) ? savedWordsSeed : [],
        currentTopic: null,
        currentIndex: 0,
        currentReadingVocab: {},
        chatHistory: [],
        currentListening: {
            transcript: "",
            questions: [],
            utterance: null,
        },
        matching: {
            level: "easy",
            pairs: [],
            enOrder: [],
            viOrder: [],
            matchedIds: new Set(),
            selected: { en: null, vi: null },
            lastSource: "",
        },
        flashcardInteraction: {
            pointerId: null,
            startX: 0,
            startY: 0,
            startTime: 0,
            isAnimating: false,
        },
        // --- Chinese ---
        cnAppData: Object.assign({}, baseCnData, savedCnTopics),
        cnSavedWordsList: Array.isArray(savedCnWordsSeed) ? savedCnWordsSeed : [],
        cnCurrentTopic: null,
        cnCurrentIndex: 0,
        cnCurrentReadingVocab: {},
        cnCurrentListening: {
            transcript: "",
            questions: [],
            utterance: null,
        },
        cnMatching: {
            level: "easy",
            pairs: [],
            zhOrder: [],
            viOrder: [],
            matchedIds: new Set(),
            selected: { zh: null, vi: null },
            lastSource: "",
        },
    };

    function persistCustomTopics() {
        const customTopics = {};
        Object.keys(state.appData).forEach((topicName) => {
            if (!Object.prototype.hasOwnProperty.call(baseData, topicName)) {
                customTopics[topicName] = state.appData[topicName];
            }
        });
        localStorage.setItem(STORAGE_KEYS.customTopics, JSON.stringify(customTopics));
    }

    function persistSavedWords() {
        localStorage.setItem(STORAGE_KEYS.savedWords, JSON.stringify(state.savedWordsList));
    }

    function persistChineseTopics() {
        const customCnTopics = {};
        Object.keys(state.cnAppData).forEach((topicName) => {
            if (!Object.prototype.hasOwnProperty.call(baseCnData, topicName)) {
                customCnTopics[topicName] = state.cnAppData[topicName];
            }
        });
        localStorage.setItem(STORAGE_KEYS.cnCustomTopics, JSON.stringify(customCnTopics));
    }

    function persistChineseSavedWords() {
        localStorage.setItem(STORAGE_KEYS.cnSavedWords, JSON.stringify(state.cnSavedWordsList));
    }

    function getCurrentWord() {
        if (!state.currentTopic) return null;
        const words = state.appData[state.currentTopic] || [];
        return words[state.currentIndex] || null;
    }

    function getCurrentChineseWord() {
        if (!state.cnCurrentTopic) return null;
        const words = state.cnAppData[state.cnCurrentTopic] || [];
        return words[state.cnCurrentIndex] || null;
    }

    function isSavedWord(word) {
        const targetKey = normalizeLookupKey(word?.en);
        return state.savedWordsList.some((item) => normalizeLookupKey(item.en) === targetKey);
    }

    function isSavedChineseWord(word) {
        const targetKey = normalizeLookupKey(word?.zh);
        return state.cnSavedWordsList.some((item) => normalizeLookupKey(item.zh) === targetKey);
    }

    function toggleSavedWord(word) {
        const targetKey = normalizeLookupKey(word?.en);
        const existingIndex = state.savedWordsList.findIndex((item) => normalizeLookupKey(item.en) === targetKey);
        if (existingIndex >= 0) {
            state.savedWordsList.splice(existingIndex, 1);
            persistSavedWords();
            return false;
        }
        state.savedWordsList.push(cloneData(word));
        persistSavedWords();
        return true;
    }

    function toggleSavedChineseWord(word) {
        const targetKey = normalizeLookupKey(word?.zh);
        const existingIndex = state.cnSavedWordsList.findIndex((item) => normalizeLookupKey(item.zh) === targetKey);
        if (existingIndex >= 0) {
            state.cnSavedWordsList.splice(existingIndex, 1);
            persistChineseSavedWords();
            return false;
        }
        state.cnSavedWordsList.push(cloneData(word));
        persistChineseSavedWords();
        return true;
    }
