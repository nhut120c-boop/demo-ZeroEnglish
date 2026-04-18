    function safeParse(rawValue, fallback) {
        if (!rawValue) {
            return fallback;
        }

        try {
            const parsed = JSON.parse(rawValue);
            return parsed ?? fallback;
        } catch {
            return fallback;
        }
    }

    function cloneData(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function clearNode(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (typeof text === "string") {
            element.textContent = text;
        }
        return element;
    }

    function show(element) {
        element.classList.remove("hidden");
    }

    function hide(element) {
        element.classList.add("hidden");
    }

    function shuffle(items) {
        const next = [...items];
        for (let index = next.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
        }
        return next;
    }

    function normalizeLookupKey(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    }

    function showError(message) {
        window.alert(message);
    }

    function setBusy(button, isBusy, busyText) {
        if (!button) {
            return;
        }

        if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = button.textContent || "";
        }

        button.disabled = isBusy;
        button.textContent = isBusy ? busyText : button.dataset.defaultLabel;
    }
