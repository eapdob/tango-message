if (!window.tangoBotInjected) {
    window.tangoBotInjected = true;

    let messages = [];
    let searchQueries = [];
    let currentQueryIndex = 0;
    let profilesQueue = [];

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randomDelay(min = 300, max = 1500) {
        return wait(min + Math.random() * (max - min));
    }

    async function typeLikeHuman(element, text) {
        element.focus();
        element.value = "";
        for (let char of text) {
            element.value += char;
            element.dispatchEvent(new Event("input", {bubbles: true}));
            await wait(50 + Math.random() * 120);
        }
    }

    async function waitForSelector(selector, retries = 20, delay = 500) {
        for (let i = 0; i < retries; i++) {
            const el = document.querySelector(selector);
            if (el) return el;
            await wait(delay);
        }
        return null;
    }

    async function waitForProfileLinks(minCount = 1, retries = 10, delay = 500) {
        console.log('waitForProfileLinks');
        for (let i = 0; i < retries; i++) {
            const links = [...document.querySelectorAll('a[href^="/profile/"], [data-testid="conversations-list"] a[href^="/"]:not([href^="/chat/"]')];
            console.log('links', links);
            if (links.length >= minCount && (i+1) == retries) {
                return links;
            }
            await wait(delay);
        }
        return [];
    }

    async function handleChatHistoryPage() {
        console.log('handleChatHistoryPage');
        await wait(750);
        const links = await waitForProfileLinks(1, 20, 100);

        const mainChatLinks = links
            .map(link => link.getAttribute("href"))
            .filter(Boolean);

        console.log('mainChatLinks', mainChatLinks);

        const allLinks = Array.from(new Set(mainChatLinks));

        console.log('allLinks', allLinks);

        await chrome.storage.local.set({historyLinks: allLinks});
        await wait(750);

        window.location.href = "https://www.tango.me/search";
    }

    async function searchAndProcess(query, max = 1000) {
        console.log('profilesQueue', profilesQueue);
        if (!profilesQueue.length) {
            const input = await waitForSelector('[data-testid="search-input"]', 30, 500);
            if (!input) return;

            await typeLikeHuman(input, query);
            ["keydown", "keypress", "keyup"].forEach(evt =>
                input.dispatchEvent(new KeyboardEvent(evt, {key: "Enter", bubbles: true}))
            );
            await wait(5000);

            const items = [...document.querySelectorAll('[data-testid^="search-result-item-"]')];
            console.log('items found:', items.length);

            profilesQueue = items.map(item => {
                const link = item.querySelector('a[href^="/profile/"], a[href^="/"]');
                const href = link?.getAttribute('href');
                if (href && (href.startsWith('/profile/') || /^\/[^/]+$/.test(href))) {
                    return href;
                }
                return null;
            }).filter(Boolean);

            console.log('profilesQueue:', profilesQueue);
        }

        const {historyLinks = []} = await chrome.storage.local.get("historyLinks");
        console.log('historyLinks', historyLinks);

        while (profilesQueue.length) {
            const href = profilesQueue.shift();
            console.log('href', href);
            console.log('historyLinks.includes(href)', historyLinks.includes(href));
            if (!href || historyLinks.includes(href)) continue;

            await chrome.storage.local.set({isSearching: true, currentQuery: query});
            window.location.href = `https://www.tango.me${href}`;
            return;
        }

        currentQueryIndex++;
        console.log('currentQueryIndex', currentQueryIndex);
        if (currentQueryIndex < searchQueries.length) {
            profilesQueue = [];
            await chrome.storage.local.set({isSearching: true, currentQuery: searchQueries[currentQueryIndex]});
            window.location.href = "https://www.tango.me/search";
        } else {
            profilesQueue = [];
            await chrome.storage.local.remove(["isSearching", "currentQuery"]);
            console.log("✅ searchAndProcess ended");
            window.location.href = "https://www.tango.me";
        }
    }

    async function handleProfile() {
        const href = window.location.pathname;
        console.log('href', href);

        const chatBtn = await waitForSelector('a[data-testid="chat"]', 20, 500);
        if (!chatBtn) {
            await chrome.storage.local.set({isSearching: true});
            return (window.location.href = "https://www.tango.me/search");
        }

        chatBtn.click();
        await wait(5000);

        const textarea = await waitForSelector('[data-testid="textarea"]', 10, 500);
        if (!textarea) {
            await chrome.storage.local.set({isSearching: true});
            return (window.location.href = "https://www.tango.me/search");
        }

        const msg = messages[Math.floor(Math.random() * messages.length)];
        console.log('messages', messages);
        console.log('msg', msg);
        await typeLikeHuman(textarea, msg);

        const send = document.querySelector('[data-testid="chat-send-message-button"]');
        if (send) {
            await randomDelay(500, 1000);
            send.click();
        }

        handleChatHistoryPage();
    }

    chrome.runtime.onMessage.addListener(async msg => {
        if (msg.type === "start_search") {
            console.log("🟢 Start");
            const stored = await chrome.storage.local.get(["messages", "searchQueries"]);
            messages = stored.messages || [];
            searchQueries = stored.searchQueries || [];
            console.log('messages', messages);
            console.log('searchQueries', searchQueries);
            currentQueryIndex = 0;
            profilesQueue = [];

            await chrome.storage.local.set({isSearching: true, currentQuery: searchQueries[0]});
            window.location.href = "https://www.tango.me/chat";
            await handleChatHistoryPage();
        }

        if (msg.type === "stop") {
            await chrome.storage.local.remove(["isSearching", "currentQuery"]);
            profilesQueue = [];
            console.log("🛑 Stop");
        }
    });

    (async () => {
        const {isSearching, currentQuery} = await chrome.storage.local.get(["isSearching", "currentQuery"]);
        const stored = await chrome.storage.local.get(["messages", "searchQueries"]);
        messages = stored.messages || [];
        searchQueries = stored.searchQueries || [];
        const path = window.location.pathname;

        if (isSearching && currentQuery) {
            currentQueryIndex = searchQueries.indexOf(currentQuery);
            console.log('isSearching', isSearching);
            console.log('currentQuery', currentQuery);
            console.log('currentQueryIndex', currentQueryIndex);
            console.log('path', path);

            await wait(1000);

            if (path === "/chat") {
                console.log("♻️ History...");
                await handleChatHistoryPage();
            } else if (path.startsWith("/search")) {
                console.log("♻️ Search...");
                await searchAndProcess(currentQuery.trim(), 1000);
            } else if (path.startsWith("/profile/") || path !== "/") {
                console.log("♻️ Profile...");
                await handleProfile();
            }
        }
    })();
}