if (!window.tangoBotInjected) {
    window.tangoBotInjected = true;

    let messages = [];
    let streamsQueue = [];
    let giftersSelectors = [];
    let currentStream = '';

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

    async function waitForProfileLinks(minCount = 1, retries = 20, delay = 500) {
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

    async function waitForStreamsLinks(minCount = 1, retries = 20, delay = 500) {
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

    async function waitForGiftersLinks(minCount = 1, retries = 20, delay = 500) {
        console.log('waitForGiftersLinks');
        for (let i = 0; i < retries; i++) {
            const links = [...document.querySelectorAll('[data-testid="viewers"] .simplebar-content > [data-testid]')];
            console.log('links', links);
            if (links.length >= minCount) {
                return links;
            }
            await wait(delay);
        }
        return [];
    }

    async function autoScrollToBottom(selector = '.simplebar-content-wrapper', times = 20, delay = 500) {
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
        await randomDelay(500, 750);
        if (!streamsQueue.length) {
            const items = await waitForStreamsLinks(1, 20, 500);
            console.log('items found:', items.length);
            streamsQueue = items.map(item => {
                const href = item?.getAttribute('href');
                if (href && (href.startsWith('/stream/') || /^\/[^/]+$/.test(href))) {
                    return href;
                }
                return null;
            }).filter(Boolean);
            console.log('streamsQueue:', streamsQueue);
            await randomDelay(500, 750);
            await chrome.storage.local.set({streamsQueue: streamsQueue});
        }
        while (streamsQueue.length) {
            const href = streamsQueue.shift();
            await chrome.storage.local.set({streamsQueue: streamsQueue});
            console.log('href', href);
            console.log('streamsQueue:', streamsQueue);
            await randomDelay(500, 750);
            if (!href) continue;
            await chrome.storage.local.set({currentStream: href});
            window.location.href = `https://www.tango.me${href}`;
            return;
        }
        console.log('streamsQueue:', streamsQueue);
        console.log('handleStreams end');
        await randomDelay(500, 750);
        window.location.href = "https://www.tango.me";
    }

    async function handleStream() {
        console.log('handleStream');
        currentStream = window.location.href;
        await chrome.storage.local.set({currentStream: currentStream});
        await randomDelay(500, 1000);
        if (!giftersSelectors.length) {
            const gifters = await waitForGiftersLinks(1, 20, 500);
            if (gifters.length > 0) {
                giftersSelectors = gifters.map(el => el.getAttribute('data-testid'));
            } else {
                const topGiftersButton = await waitForSelector('[data-testid="stream-go-back"] + div > [data-testid^="top-gifters"]', 20, 500);
                console.log('topGiftersButton', topGiftersButton);
                await randomDelay(500, 750);
                if (!topGiftersButton) {
                    console.log('topGiftersButton not found', topGiftersButton);
                    return window.location.href = "https://www.tango.me/live/popular";
                } else {
                    console.log('topGiftersButton click');
                    topGiftersButton.click();
                    await randomDelay(500, 750);
                    const gifters = await waitForGiftersLinks(1, 20, 500);
                    if (gifters) {
                        giftersSelectors = gifters.map(el => el.getAttribute('data-testid'));
                    }
                    console.log('giftersSelectors', giftersSelectors);
                    await randomDelay(500, 750);
                }
            }
            await chrome.storage.local.set({ giftersSelectors: giftersSelectors });
        }
        const { historyLinks = [] } = await chrome.storage.local.get("historyLinks");
        while (giftersSelectors.length) {
            const selector = giftersSelectors.shift();
            await chrome.storage.local.set({ giftersSelectors: giftersSelectors });
            console.log('giftersSelectors', giftersSelectors);

            let viewers = document.querySelectorAll('[data-testid="viewers"] .simplebar-content > [data-testid]');
            if (viewers.length === 0) {
                const topGiftersButton = await waitForSelector('[data-testid="stream-go-back"] + div > [data-testid^="top-gifters"]', 20, 500);
                if (topGiftersButton) {
                    topGiftersButton.click();
                    await randomDelay(500, 750);
                } else if (!topGiftersButton) {
                    continue;
                }
            }

            const gifter = document.querySelector(`[data-testid="viewers"] .simplebar-content > [data-testid="${selector}"]`);
            console.log('gifter', gifter);
            await randomDelay(500, 750);
            if (!gifter) continue;
            gifter.click();

            await randomDelay(500, 750);
            const messageButton = document.querySelector('#modal-content a[href^="/chat/"]');
            await randomDelay(500, 750);
            if (!messageButton || historyLinks.includes(messageButton?.getAttribute("href"))) continue;
            console.log('historyLinks', historyLinks);
            console.log('messageButton.getAttribute("href")', messageButton?.getAttribute("href"));
            console.log('historyLinks.includes(href)', historyLinks.includes(messageButton?.getAttribute("href")));
            messageButton.click();
            await randomDelay(500, 750);

            const textarea = await waitForSelector('[data-testid="textarea"]', 20, 500);
            if (!textarea) return currentStream;
            await randomDelay(500, 750);
            const msg = messages[Math.floor(Math.random() * messages.length)];
            await typeLikeHuman(textarea, msg);
            const send = document.querySelector('[data-testid="chat-send-message-button"]');
            if (send) {
                await randomDelay(500, 750);
                send.click();
                await handleChatHistoryPage();
                return;
            }
        }

        window.location.href = "https://www.tango.me/live/popular";
        await handleStreams();
    }

    async function handleChatHistoryPage() {
        console.log('handleChatHistoryPage');
        await randomDelay(3000, 3500);
        await autoScrollToBottom('.simplebar-content-wrapper', 20, 1000);
        const links = await waitForProfileLinks(1, 20, 500);
        const mainChatLinks = links
            .map(link => link.getAttribute("href"))
            .filter(Boolean);
        const allLinks = Array.from(new Set(mainChatLinks));
        console.log('allLinks', allLinks);
        console.log('currentStream', currentStream);
        await randomDelay(500, 750);
        await chrome.storage.local.set({historyLinks: allLinks});
        if (currentStream) {
            console.log('go to currentStream', currentStream);
            await randomDelay(500, 750);
            window.location.href = currentStream;
            return;
        } else {
            console.log('go to streams page');
            await randomDelay(500, 750);
            window.location.href = "https://www.tango.me/live/popular";
            return;
        }
    }

    chrome.runtime.onMessage.addListener(async msg => {
        if (msg.type === "start_search") {
            const stored = await chrome.storage.local.get(["messages", "currentStream", "streamsQueue", "giftersSelectors"]);
            messages = stored.messages || [];
            currentStream = stored.currentStream || '';
            streamsQueue = stored.streamsQueue || [];
            giftersSelectors = stored.giftersSelectors || [];
            window.location.href = "https://www.tango.me/chat";
            await handleChatHistoryPage();
        }
        if (msg.type === "stop") {
            await chrome.storage.local.remove(["currentStream", "streamsQueue", "giftersSelectors"]);
            streamsQueue = [];
            giftersSelectors = [];
            currentStream = '';
            console.log("🛑 Stop");
        }
    });

    (async () => {
        const stored = await chrome.storage.local.get(["messages", "currentStream", "streamsQueue", "giftersSelectors"]);
        messages = stored.messages || [];
        currentStream = stored.currentStream || '';
        streamsQueue = stored.streamsQueue || [];
        giftersSelectors = stored.giftersSelectors || [];
        const path = window.location.pathname;
        if (streamsQueue) {
            if (path === "/chat") {
                await handleChatHistoryPage();
            } else if (path === "/live/popular") {
                await handleStreams();
            } else if (path.startsWith("/stream/")) {
                await handleStream();
            }
        }
    })();
}