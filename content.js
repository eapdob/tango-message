if (!window.tangoBotInjected) {
    window.tangoBotInjected = true;

    const HISTORY_LINKS_MAX_HISTORY = 200;
    const HISTORY_LINKS_THRESHOLD = 250;
    const FRESH_LIMIT = 42;
    const DEBUG = true;
    const GIFTERS_LIMIT = 5;
    let messages = [];
    let streamsQueue = [];
    let giftersChatLinks = [];
    let historyLinks = [];
    let historyInitialized = false;
    let currentStream = '';

    function wait(ms) {
        if (DEBUG) console.log('wait', ms);

        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randomDelay(min = 250, max = 500) {
        if (DEBUG) console.log('randomDelay', min, max);

        return wait(min + Math.random() * (max - min));
    }

    async function typeLikeHuman(element, text) {
        if (DEBUG) console.log('typeLikeHuman', element, text);

        element.focus();
        element.value = "";
        for (let char of text) {
            element.value += char;
            element.dispatchEvent(new Event("input", {bubbles: true}));
            await wait(200 + Math.random() * 120);
        }
    }

    async function waitForSelector(selector, retries = 20, delay = 500) {
        if (DEBUG) console.log('waitForSelector', selector);

        for (let i = 0; i < retries; i++) {
            const el = document.querySelector(selector);
            if (el) {
                if (DEBUG) console.log('waitForSelector', el);

                return el;
            }
            await wait(delay);
        }
        return null;
    }

    async function waitForSelectors(selector, minCount = 1, retries = 20, delay = 500) {
        if (DEBUG) console.log('waitForSelectors', selector);

        for (let i = 0; i < retries; i++) {
            const links = [...document.querySelectorAll(selector)];
            if (links.length >= minCount) {
                if (DEBUG) console.log('waitForSelectors', links);

                return links;
            }
            await wait(delay);
        }
        return [];
    }

    function collectHrefArrayFromSelector(selector, limit = null) {
        if (DEBUG) console.log('collectHrefArrayFromSelector', selector);

        const hrefs = [...document.querySelectorAll(selector)]
            .map(a => a.getAttribute('href'))
            .filter(Boolean);

        if (DEBUG) console.log('collectHrefArrayFromSelector hrefs', hrefs);

        return limit ? hrefs.slice(0, limit) : hrefs;
    }

    async function autoScrollToBottom(selector, times = 20, delay = 1000) {
        if (DEBUG) console.log('autoScrollToBottom start');

        let el = document.querySelector(selector);

        if (!el) {
            el = document.querySelector('.simplebar-content')
                || document.querySelector('[data-testid="inbox"] .simplebar-content-wrapper')
                || document.querySelector('[data-testid="inbox"] .simplebar-content');
        }

        if (!el) {
            if (DEBUG) console.warn(`❗ Scroll container not found by "${selector}", using document`);

            el = document.scrollingElement || document.documentElement || document.body;
        }

        let lastHeight = -1;
        for (let i = 0; i < times; i++) {
            el.scrollTo(0, el.scrollHeight);
            await wait(delay);
            const newHeight = el.scrollHeight;
            if (newHeight === lastHeight) {
                if (DEBUG) console.log("✅ No more new content loaded.");

                break;
            }
            lastHeight = newHeight;
        }

        if (DEBUG) console.log("autoScrollToBottom end");
    }

    async function handleStreams() {
        if (DEBUG) console.log('handleStreams start');
        if (DEBUG) console.log('handleStreams streamsQueue', streamsQueue);
        await randomDelay(1500, 3000);

        if (!streamsQueue || streamsQueue.length === 0) {
            const streams = await waitForSelectors('a[href^="/stream/"]');

            if (DEBUG) console.log('handleStreams streams', streams)
            if (DEBUG) console.log('handleStreams streams.length', streams.length);

            if (!streams || streams.length === 0) return;

            if (streams) {
                streamsQueue = streams.map(item => {
                    const href = item?.getAttribute('href');
                    if (href && (href.startsWith('/stream/') || /^\/[^/]+$/.test(href))) {
                        return href;
                    }
                    return null;
                }).filter(Boolean);
            }

            if (DEBUG) console.log('handleStreams streamsQueue:', streamsQueue);

            await chrome.storage.local.set({streamsQueue: streamsQueue});
        }

        if (DEBUG) console.log('handleStreams streamsQueue:', streamsQueue);

        if (streamsQueue.length) {
            const href = streamsQueue.shift();
            await chrome.storage.local.set({streamsQueue: streamsQueue});

            if (DEBUG) console.log('handleStreams href', href);

            await chrome.storage.local.set({currentStream: href});
            window.location.href = `https://www.tango.me${href}`;
            return;
        }

        if (DEBUG) console.log('handleStreams end');

        //window.location.href = "https://www.tango.me";
        window.location.href = "https://www.tango.me/live/popular";
    }

    async function handleStream() {
        if (DEBUG) console.log('handleStream start');
        await randomDelay(3000, 6000);

        currentStream = window.location.href;
        await chrome.storage.local.set({currentStream: currentStream});

        if (!giftersChatLinks.length || giftersChatLinks.length === 0) {
            const topGiftersButton = await waitForSelector('[data-testid="stream-go-back"] + div > [data-testid^="top-gifters"]');

            if (DEBUG) console.log('handleStream topGiftersButton', topGiftersButton);

            if (!topGiftersButton) {
                if (DEBUG) console.log('handleStream topGiftersButton not found', topGiftersButton);

                window.location.href = "https://www.tango.me/live/popular";

                return;
            } else {
                if (DEBUG) console.log('handleStream topGiftersButton click');

                topGiftersButton.click();

                const gifters = await waitForSelectors('[data-testid="viewers"] .simplebar-content > [data-testid]');

                if (DEBUG) console.log('handleStream gifters', gifters);

                if (!gifters || gifters.length === 0) {
                    if (DEBUG) console.log('handleStream gifters not found', topGiftersButton);

                    window.location.href = "https://www.tango.me/live/popular";

                    return;
                }

                if (DEBUG) console.log('handleStream gifters', gifters);

                let i = 0;
                for (const gifter of gifters) {
                    if (i > GIFTERS_LIMIT) continue;
                    i++;
                    gifter.click();

                    await randomDelay(1000, 1500);

                    const gifterChatNode = await waitForSelector('[data-testid="chat"]');
                    const gifterChatLink = gifterChatNode?.getAttribute('href');

                    if (gifterChatLink && !giftersChatLinks.includes(gifterChatLink)) {
                        if (DEBUG) console.log('handleStream gifterChatLink', gifterChatLink);

                        giftersChatLinks.push(gifterChatLink);
                    }

                    if (DEBUG) console.log('handleStream giftersChatLinks', giftersChatLinks);
                }
            }
        }

        if (DEBUG) console.log('handleStream giftersChatLinks', giftersChatLinks);

        if (giftersChatLinks.length) {
            let gifterChatLink = giftersChatLinks.shift();
            await chrome.storage.local.set({giftersChatLinks: giftersChatLinks});

            if (!giftersChatLinks.length || giftersChatLinks.length === 0) {
                currentStream = '';
                await chrome.storage.local.set({currentStream: currentStream});
                if (DEBUG) console.log('handleStream canceling currentStream', currentStream);
            }

            if (historyLinks.includes(gifterChatLink)) {
                if (DEBUG) console.log('handleStream skip to chat', gifterChatLink);

                if (currentStream) {
                    if (DEBUG) console.log('handleStream to currentStream', currentStream);

                    window.location.href = currentStream;
                    return;
                } else {
                    if (DEBUG) console.log('handleStream to streams');

                    window.location.href = "https://www.tango.me/live/popular";
                    return;
                }
            }

            if (DEBUG) console.log('handleStream to chat', gifterChatLink);

            window.location.href = `https://www.tango.me${gifterChatLink}`;
        } else {
            if (DEBUG) console.log('handleStream to streams');

            window.location.href = "https://www.tango.me/live/popular";
        }
    }

    async function handleChatPage() {
        if (DEBUG) console.log('handleChatPage');
        await randomDelay(3000, 6000);

        const fresh = collectHrefArrayFromSelector('.simplebar-content > div a[href^="/chat/"]', FRESH_LIMIT);
        const set = new Set(fresh);
        for (const href of historyLinks) {
            if (!set.has(href)) set.add(href);
        }
        let finalLinks = Array.from(set);
        if (finalLinks.length > HISTORY_LINKS_THRESHOLD) {
            if (DEBUG) console.log(`handleChatPage removing finalLinks: ${finalLinks.length} -> ${HISTORY_LINKS_MAX_HISTORY}`);

            finalLinks = finalLinks.slice(-HISTORY_LINKS_MAX_HISTORY);
        }
        await chrome.storage.local.set({historyLinks: finalLinks});
        if (DEBUG) console.log('handleChatPage historyLinks', historyLinks);

        await randomDelay(1500, 2000);
        const textarea = await waitForSelector('[data-testid="textarea"]');
        if (DEBUG) console.log('handleChatPage textarea', textarea);

        if (!textarea) {
            if (currentStream) {
                if (DEBUG) console.log('handleChatPage to currentStream', currentStream);

                window.location.href = currentStream;
                return;
            } else {
                if (DEBUG) console.log('handleChatPage to streams');

                window.location.href = "https://www.tango.me/live/popular";
                return;
            }
        }

        const msg = messages[Math.floor(Math.random() * messages.length)];
        if (DEBUG) console.log('handleChatPage msg', msg);

        await typeLikeHuman(textarea, msg);

        await randomDelay(1500, 2000);
        const send = await waitForSelector('[data-testid="chat-send-message-button"]');
        if (DEBUG) console.log('handleChatPage send', send);

        if (!send) {
            if (currentStream) {
                if (DEBUG) console.log('handleChatPage to currentStream', currentStream);

                window.location.href = currentStream;
                return;
            } else {
                if (DEBUG) console.log('handleChatPage to streams');

                window.location.href = "https://www.tango.me/live/popular";
                return;
            }
        }
        send.click();
        if (DEBUG) console.log('handleChatPage send click', send);

        await randomDelay(1500, 2000);

        if (giftersChatLinks.length) {
            if (currentStream) {
                if (DEBUG) console.log('handleChatPage to currentStream', currentStream);

                window.location.href = currentStream;
            } else {
                if (DEBUG) console.log('handleChatPage to streams');

                window.location.href = "https://www.tango.me/live/popular";
            }
        } else {
            if (DEBUG) console.log('handleStream to streams');

            window.location.href = "https://www.tango.me/live/popular";
        }
    }

    async function handleChatHistoryPage() {
        if (DEBUG) console.log('handleChatHistoryPage');
        await randomDelay(3000, 4500);

        let finalLinks;

        if (!historyInitialized) {
            await autoScrollToBottom('.simplebar-content-wrapper');
            const allHrefs = collectHrefArrayFromSelector('.simplebar-content > div a[href^="/chat/"]');
            finalLinks = Array.from(new Set(allHrefs));
            if (finalLinks.length > HISTORY_LINKS_MAX_HISTORY) {
                if (DEBUG) console.log(`handleChatHistoryPage removing finalLinks: ${finalLinks.length} -> ${HISTORY_LINKS_MAX_HISTORY}`);

                finalLinks = finalLinks.slice(-HISTORY_LINKS_MAX_HISTORY);
            }
            await chrome.storage.local.set({
                historyLinks: finalLinks,
                historyInitialized: true
            });

            if (DEBUG) console.log('handleChatHistoryPage finalLinks', finalLinks);
        } else {
            const fresh = collectHrefArrayFromSelector('.simplebar-content > div a[href^="/chat/"]', FRESH_LIMIT);
            const set = new Set(fresh);
            for (const href of historyLinks) {
                if (!set.has(href)) set.add(href);
            }
            finalLinks = Array.from(set);
            if (finalLinks.length > HISTORY_LINKS_THRESHOLD) {
                if (DEBUG) console.log(`handleChatHistoryPage removing finalLinks: ${finalLinks.length} -> ${HISTORY_LINKS_MAX_HISTORY}`);

                finalLinks = finalLinks.slice(-HISTORY_LINKS_MAX_HISTORY);
            }
            await chrome.storage.local.set({historyLinks: finalLinks});

            if (DEBUG) console.log('handleChatHistoryPage finalLinks', finalLinks);
        }

        if (DEBUG) console.log('handleChatHistoryPage go to streams page');

        window.location.href = "https://www.tango.me/live/popular";
    }

    chrome.runtime.onMessage.addListener(async msg => {
        if (msg.type === "start_search") {
            const stored = await chrome.storage.local.get(["messages", "streamsQueue", "giftersChatLinks", "historyLinks", "historyInitialized", "currentStream"]);
            messages = stored.messages || [];
            streamsQueue = stored.streamsQueue || [];
            giftersChatLinks = stored.giftersChatLinks || [];
            historyLinks = stored.historyLinks || [];
            historyInitialized = stored.historyInitialized || false;
            currentStream = stored.currentStream || '';
            window.location.href = "https://www.tango.me/chat";
            await handleChatHistoryPage();
        }
        if (msg.type === "stop") {
            await chrome.storage.local.remove(["messages", "streamsQueue", "giftersChatLinks", "historyLinks", "historyInitialized", "currentStream"]);
            messages = [];
            streamsQueue = [];
            giftersChatLinks = [];
            historyLinks = [];
            historyInitialized = false;
            currentStream = '';
            console.log("🛑 Stop");
        }
    });

    (async () => {
        const stored = await chrome.storage.local.get(["messages", "streamsQueue", "giftersChatLinks", "historyLinks", "historyInitialized", "currentStream"]);
        messages = stored.messages || [];
        streamsQueue = stored.streamsQueue || [];
        giftersChatLinks = stored.giftersChatLinks || [];
        historyLinks = stored.historyLinks || [];
        historyInitialized = stored.historyInitialized || false;
        currentStream = stored.currentStream || '';
        const path = window.location.pathname;
        if (streamsQueue) {
            if (path === "/chat") {
                await handleChatHistoryPage();
            } else if (path.startsWith("/chat/")) {
                await handleChatPage();
            } else if (path === "/live/popular") {
                await handleStreams();
            } else if (path.startsWith("/stream/")) {
                await handleStream();
            }
        }
    })();
}