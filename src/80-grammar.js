    async function handleGrammarGeneration() {
        setBusy(refs.generateGrammarBtn, true, "Đang lấy...");
        show(refs.grammarLoadingMsg);
        hide(refs.grammarBox);

        try {
            const data = await api.generateGrammar(refs.grammarSelect.value);
            refs.grammarTitle.textContent = data.title;
            refs.grammarFormula.textContent = data.formula;
            refs.grammarUsage.textContent = data.usage;

            clearNode(refs.grammarExamples);
            data.examples.forEach((example) => {
                refs.grammarExamples.appendChild(createElement("li", "", example));
            });

            show(refs.grammarBox);
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(refs.generateGrammarBtn, false, "Đang lấy...");
            hide(refs.grammarLoadingMsg);
        }
    }

    function initGrammar() {
        refs.generateGrammarBtn.addEventListener("click", handleGrammarGeneration);
    }
