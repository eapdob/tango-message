if (!window.tangoBotInjected) {
    window.tangoBotInjected = true;

    let messages = [];
    let streamsQueue = [];
    let gifters = [];
    let currentStreamLink = '';

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
            const links = [...document.querySelectorAll('.simplebar-content > div a[href^="/chat/"]')];
            console.log('links', links);
            if (links.length >= minCount) {
                return links;
            }
            await wait(delay);
        }
        return [];
    }

    async function waitForStreamsLinks(minCount = 1, retries = 10, delay = 500) {
        console.log('waitForStreamsLinks');
        for (let i = 0; i < retries; i++) {
            const links = [...document.querySelectorAll('a[href^="/stream/"]')];
            console.log('links', links);
            if (links.length >= minCount) {
                return links;
            }
            await wait(delay);
        }
        return [];
    }

    async function waitForGiftersLinks(minCount = 1, retries = 10, delay = 500) {
        console.log('waitForGiftersLinks');
        for (let i = 0; i < retries; i++) {
            const links = [...document.querySelectorAll('.simplebar-content [data-testid^="top-gifters-avatar"]')];
            console.log('links', links);
            if (links.length >= minCount) {
                return links;
            }
            await wait(delay);
        }
        return [];
    }

    async function autoScrollToBottom(selector = '.simplebar-content-wrapper', times = 20, delay = 1000) {
        const el = document.querySelector(selector);
        if (!el) return console.warn(`❌ Selector not found: ${selector}`);

        let lastHeight = 0;

        for (let i = 0; i < times; i++) {
            el.scrollTo(0, el.scrollHeight);
            console.log(`🔄 Scroll ${i + 1}/${times}`);
            await new Promise(resolve => setTimeout(resolve, delay));

            const newHeight = el.scrollHeight;
            if (newHeight === lastHeight) {
                console.log("✅ No more new content loaded.");
                break;
            }
            lastHeight = newHeight;
        }

        console.log("✅ Done auto scrolling.");
    }

    async function handleStreams() {
        console.log('handleStreams');
        console.log('streamsQueue', streamsQueue);
        if (!streamsQueue.length) {
            const items = await waitForStreamsLinks(1, 100, 500);
            console.log('items found:', items.length);

            streamsQueue = items.map(item => {
                const href = item?.getAttribute('href');
                if (href && (href.startsWith('/stream/') || /^\/[^/]+$/.test(href))) {
                    return href;
                }
                return null;
            }).filter(Boolean);

            console.log('streamsQueue:', streamsQueue);
        }

        while (streamsQueue.length) {
            const href = streamsQueue.shift();
            console.log('href', href);
            if (!href) continue;

            await chrome.storage.local.set({currentStream: href});
            window.location.href = `https://www.tango.me${href}`;
            return;
        }

        window.location.href = "https://www.tango.me";
    }

    async function handleStream() {
        currentStreamLink = window.location.href;

        await wait(2500);

        const topGiftersButton = await waitForSelector('[data-testid="stream-go-back"] + div > [data-testid^="top-gifters"]', 100, 500);
        if (!topGiftersButton) {
            await chrome.storage.local.set({isSearching: true});
            return (window.location.href = "https://www.tango.me/live/nearby");
        }
        topGiftersButton.click();

        await wait(2500);

        if (!gifters.length) {
            gifters = await waitForGiftersLinks(1, 100, 500);
        }

        const {historyLinks = []} = await chrome.storage.local.get("historyLinks");

        while (gifters.length) {
            let gifter = gifters.shift();
            gifter.click();

            await wait(2500);

            let messageButton = document.querySelector('#modal-content a[href^="/chat/"]');
            if (!messageButton) {
                continue;
            }
            console.log('historyLinks', historyLinks);
            console.log('messageButton.getAttribute("href")', messageButton.getAttribute("href"));
            console.log('historyLinks.includes(href)', historyLinks.includes(messageButton.getAttribute("href")));

            await wait(2500);

            if (historyLinks.includes(messageButton.getAttribute("href"))) {
                continue;
            }

            messageButton.click();

            await wait(2500);

            const textarea = await waitForSelector('[data-testid="textarea"]', 50, 500);
            if (!textarea) {
                await chrome.storage.local.set({isSearching: true});
                return currentStreamLink;
            }

            const msg = messages[Math.floor(Math.random() * messages.length)];
            console.log('messages', messages);
            console.log('msg', msg);
            await typeLikeHuman(textarea, msg);

            const send = document.querySelector('[data-testid="chat-send-message-button"]');
            if (send) {
                await randomDelay(500, 1000);
                send.click();
                handleChatHistoryPage();
                return;
            }
        }

        window.location.href = "https://www.tango.me/live/nearby";
        await handleStreams();
    }

    async function handleChatHistoryPage() {
        console.log('handleChatHistoryPage');

        await wait(2500);

        await autoScrollToBottom('.simplebar-content-wrapper', 20, 1000);

        const links = await waitForProfileLinks(1, 100, 500);
        const mainChatLinks = links
            .map(link => link.getAttribute("href"))
            .filter(Boolean);
        const allLinks = Array.from(new Set(mainChatLinks));

        console.log('allLinks', allLinks);
        console.log('currentStreamLink', currentStreamLink);

        await chrome.storage.local.set({historyLinks: allLinks});

        if (currentStreamLink) {
            window.location.href = currentStreamLink;
            return;
        } else {
            window.location.href = "https://www.tango.me/live/nearby";
            return;
        }

    }

    chrome.runtime.onMessage.addListener(async msg => {
        if (msg.type === "start_search") {
            console.log("🟢 Start");
            const stored = await chrome.storage.local.get(["messages"]);
            messages = stored.messages || [];
            console.log('messages', messages);

            await chrome.storage.local.set({currentStream: 'test'});
            window.location.href = "https://www.tango.me/chat";
            await handleChatHistoryPage();
        }

        if (msg.type === "stop") {
            await chrome.storage.local.remove(["streamsQuery"]);
            profilesQueue = [];
            console.log("🛑 Stop");
        }
    });

    (async () => {
        const {currentStream} = await chrome.storage.local.get(["currentStream"]);
        const stored = await chrome.storage.local.get(["messages"]);
        messages = stored.messages || [];
        const path = window.location.pathname;

        if (currentStream) {
            console.log('currentStream', currentStream);
            console.log('currentStreamLink', currentStreamLink);
            console.log('path', path);

            await wait(1000);

            if (path === "/chat") {
                console.log("♻️ handleChatHistoryPage...");
                await handleChatHistoryPage();
            } else if (path === "/live/nearby") {
                console.log("♻️ handleStreams...");
                await handleStreams();
            } else if (path.startsWith("/stream/")) {
                console.log("♻️ handleStream...");
                await handleStream();
            }
        }
    })();
}