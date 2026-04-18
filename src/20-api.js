    async function parseResponse(response) {
        const rawText = await response.text();
        let data = {};

        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error("Server trả về dữ liệu không đọc được.");
            }
        }

        if (!response.ok) {
            throw new Error(data.error || "Yêu cầu thất bại.");
        }

        return data;
    }

    async function postJson(path, payload) {
        const response = await fetch(path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return parseResponse(response);
    }

    const api = {
        getBootstrap() {
            return fetch("/api/bootstrap", {
                headers: {
                    "Accept": "application/json",
                },
            }).then(parseResponse);
        },
        generateTopic(topic) {
            return postJson("/api/ai/topic", { topic });
        },
        explainSentence(sentence) {
            return postJson("/api/ai/explain", { sentence });
        },
        generateReading(level) {
            return postJson("/api/ai/reading", { level });
        },
        generateGrammar(topic) {
            return postJson("/api/ai/grammar", { topic });
        },
        chat(history) {
            return postJson("/api/ai/chat", { history });
        },
        generateListening(level) {
            return postJson("/api/ai/listening", { level });
        },
        generateMatching(level) {
            return postJson("/api/ai/matching", { level });
        },
    };
