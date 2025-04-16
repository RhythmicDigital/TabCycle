let intervalId = null;
let intervalSeconds = 15; // Default value

chrome.storage.local.set({ intervalSeconds });

chrome.runtime.onInstalled.addListener(({reason}) => {
    if (reason === 'install') {
        chrome.tabs.create({
            url: 'onboarding.html'
        });
    }
});

function updateInterval(newInterval) {
  intervalSeconds = newInterval;
  chrome.storage.local.set({ intervalSeconds }); // Save to storage
}

// Function to cycle through tabs
async function cycleTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true});
    const activeTab = tabs.find(tab => tab.active);
    const nextTabIndex = (activeTab.index + 1) % tabs.length;

    // Activate the next tab
    chrome.tabs.update(tabs[nextTabIndex].id, { active: true});
}

function setIntervalId(handler, interval) {
    intervalId = setInterval(handler, interval * 1000);
}

// Start cycling
function startCycling() {
    if (!intervalId) {
        setIntervalId(cycleTabs, intervalSeconds);
        console.log(`Started cycling every ${intervalSeconds} seconds.`);
    }
}

// Stop cycling
function stopCycling() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("Stopped cycling.");
    }
}

// Listens for messages from popup or other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "start") {
        intervalSeconds = message.interval || 5;
        startCycling();
    } else if (message.command === "stop") {
        stopCycling();
    }
    if (message.action === "setInterval") {
        updateInterval(message.value);
        stopCycling();
        startCycling();
        sendResponse({ success: true });
      }
    sendResponse({ success: true });
});