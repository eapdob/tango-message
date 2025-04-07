chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "inject_bot") {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                if (!tab) {
                    console.error("❌ [background] Вкладка не знайдена");
                    sendResponse({success: false, error: "Tab not found"});
                    return;
                }

                await chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ["content.js"]
                });

                console.log("✅ [background] Скрипт успішно ін'єктовано");
                sendResponse({success: true});
            } catch (e) {
                console.error("❌ [background] Помилка під час ін'єкції:", e);
                sendResponse({success: false, error: e.message});
            }
        })();

        return true;
    }
});
