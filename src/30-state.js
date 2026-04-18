    const baseData = typeof defaultData === "object" && defaultData ? cloneData(defaultData) : {};
    const savedTopics = safeParse(localStorage.getItem(STORAGE_KEYS.customTopics), {});
    const savedWordsSeed = safeParse(localStorage.getItem(STORAGE_KEYS.savedWords), []);

    const state = {
        bootstrap: {
            brand: BRAND_NAME,
            aiEnabled: false,
            secureMode: false,
        },
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
            selected: {
                en: null,
                vi: null,
            },
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

    function getCurrentWord() {
        if (!state.currentTopic) {
            return null;
        }
        const words = state.appData[state.currentTopic] || [];
        return words[state.currentIndex] || null;
    }

    function isSavedWord(word) {
        const targetKey = normalizeLookupKey(word?.en);
        return state.savedWordsList.some((item) => normalizeLookupKey(item.en) === targetKey);
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
