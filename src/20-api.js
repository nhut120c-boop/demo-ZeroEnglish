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

        // --- HỆ THỐNG TÀI KHOẢN (Đăng ký / Đăng nhập) ---
        register(email, name, password) {
            return postJson("/api/auth/register", { email, name, password });
        },
        login(email, password) {
            return postJson("/api/auth/login", { email, password });
        },
        // ------------------------------------------------

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
        // --- Chinese endpoints ---
        generateChineseTopic(topic) {
            return postJson("/api/ai/cn/topic", { topic });
        },
        explainChineseSentence(sentence) {
            return postJson("/api/ai/cn/explain", { sentence });
        },
        generateChineseReading(level) {
            return postJson("/api/ai/cn/reading", { level });
        },
        generateChineseListening(level) {
            return postJson("/api/ai/cn/listening", { level });
        },
        generateChineseMatching(level) {
            return postJson("/api/ai/cn/matching", { level });
        },
    };