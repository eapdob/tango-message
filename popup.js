document.addEventListener("DOMContentLoaded", async () => {
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const queriesInput = document.getElementById("searchQueries");
    const messagesInput = document.getElementById("messages");

    const {searchQueries = [], messages = []} = await chrome.storage.local.get(["searchQueries", "messages"]);
    queriesInput.value = searchQueries.join("\n");
    messagesInput.value = messages.join("\n");

    queriesInput.addEventListener("input", () => {
        const newQueries = queriesInput.value.split("\n").map(q => q.trim()).filter(Boolean);
        chrome.storage.local.set({searchQueries: newQueries});
    });

    messagesInput.addEventListener("input", () => {
        const newMessages = messagesInput.value.split("\n").map(m => m.trim()).filter(Boolean);
        chrome.storage.local.set({messages: newMessages});
    });

    startBtn.addEventListener("click", async () => {
        const searchQueries = queriesInput.value.split("\n").map(q => q.trim()).filter(Boolean);
        const messages = messagesInput.value.split("\n").map(m => m.trim()).filter(Boolean);

        await chrome.storage.local.set({searchQueries, messages});

        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tab = tabs[0];
            if (!tab) return console.error("❌ Tab not found");

            chrome.runtime.sendMessage({type: "inject_bot"}, (res) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Runtime error:", chrome.runtime.lastError.message);
                    return;
                }

                if (res?.success) {
                    console.log("✅ Injected. Running...");
                    chrome.tabs.sendMessage(tab.id, {type: "start_search"});
                } else {
                    console.error("❌ Failed injection", res?.error);
                }
            });
        });
    });

    stopBtn.addEventListener("click", () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tab = tabs[0];
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {type: "stop"});
            }
        });
    });
});
