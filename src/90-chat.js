    function appendChatMessage(sender, text) {
        const wrapper = createElement("div", `message ${sender}-message`);
        const bubble = createElement("div", "msg-bubble", text);
        wrapper.appendChild(bubble);
        refs.chatBox.appendChild(wrapper);
        refs.chatBox.scrollTop = refs.chatBox.scrollHeight;
        return wrapper;
    }

    function appendTypingIndicator() {
        const wrapper = createElement("div", "message ai-message");
        const bubble = createElement("div", "typing-indicator");
        bubble.appendChild(createElement("span"));
        bubble.appendChild(createElement("span"));
        bubble.appendChild(createElement("span"));
        wrapper.appendChild(bubble);
        refs.chatBox.appendChild(wrapper);
        refs.chatBox.scrollTop = refs.chatBox.scrollHeight;
        return wrapper;
    }

    async function handleChatSend() {
        const text = refs.chatInput.value.trim();
        if (!text) {
            return;
        }

        state.chatHistory.push({ role: "user", content: text });
        appendChatMessage("user", text);
        refs.chatInput.value = "";
        refs.chatInput.disabled = true;
        refs.sendChatBtn.disabled = true;

        const typingIndicator = appendTypingIndicator();

        try {
            const data = await api.chat(state.chatHistory);
            typingIndicator.remove();
            appendChatMessage("ai", data.message);
            state.chatHistory.push({ role: "assistant", content: data.message });
            if (state.chatHistory.length > 12) {
                state.chatHistory = state.chatHistory.slice(-12);
            }
        } catch (error) {
            typingIndicator.remove();
            appendChatMessage("ai", error.message);
        } finally {
            refs.chatInput.disabled = false;
            refs.sendChatBtn.disabled = false;
            refs.chatInput.focus();
        }
    }

    function initChat() {
        refs.sendChatBtn.addEventListener("click", handleChatSend);
        refs.chatInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleChatSend();
            }
        });
    }
