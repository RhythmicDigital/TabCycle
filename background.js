let intervalId = null;
let intervalSeconds = 5; // Default value

chrome.storage.local.set({ intervalSeconds });

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

// Start cycling
function startCycling() {
    if (!intervalId) {
        intervalId = setInterval(cycleTabs, intervalSeconds * 1000);
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
        sendResponse({ success: true });
      }
    sendResponse({ success: true });
});