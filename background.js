// Tab Cycling
let intervalId = null;
let timeoutId = null;
let intervalSeconds = 15; // Default value
let isCycling = false;
let cyclingPaused = false;
let badgeIntervalId = null;
let badgeCountdownInterval = null;
let cycleStartTime = null;
let tabIntervals = {}; // To store the interval for each tab

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
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(tab => tab.active);

    // Ensure that we're staying on the active tab for the full interval
    const interval = tabIntervals[activeTab.id] || intervalSeconds;
    const nextTabIndex = (activeTab.index + 1) % tabs.length;
    const nextTab = tabs[nextTabIndex];

    // Clear any previous timeout
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    // Update badge countdown and set the timeout for the next tab
    badgeCountdown = interval;
    updateBadge();

    // Wait for the cycle interval to expire before switching to the next tab
    timeoutId = setTimeout(() => {
        chrome.tabs.update(nextTab.id, { active: true });
        cycleTabs(); // Recursively call cycleTabs to continue cycling
    }, interval * 1000);
}


// Set per-tab cycle interval
function setTabInterval(tabId, interval) {
    tabIntervals[tabId] = interval; // Save the interval for this specific tab
}

function setIntervalId(handler, interval) {
    if (intervalId) {
        clearInterval(intervalId);
    }
    intervalId = setInterval(handler, interval * 1000);
}

function startCycling() {
    if (!isCycling) {
        chrome.storage.local.get("tabIntervals", (res) => {
            tabIntervals = res.tabIntervals || {};
            
            console.log(`Started cycling every ${tabIntervals} seconds.`);
            isCycling = true;
            cycleTabs();
            chrome.action.setIcon({   path: {
                16: "icons/pause16.png",
                48: "icons/pause48.png",
                128: "icons/pause128.png"
            } });

            startBadgeTimer();
        });
    }
}

function stopCycling() {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        console.log("Stopped cycling.");
    }
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
        badgeIntervalId = null;
    }
    isCycling = false;

    chrome.action.setIcon({   path: {
        16: "icons/play16.png",
        48: "icons/play48.png",
        128: "icons/play128.png"
    } }); 
    chrome.action.setBadgeText({ text: '' });
}

function startBadgeTimer() {
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
    }
    
    badgeIntervalId = setInterval(() => {
        if (badgeCountdown > 0) {
            badgeCountdown--;
            updateBadge();
        }
    }, 1000);
}

function updateBadge() {
    chrome.action.setBadgeText({
        text: badgeCountdown > 0 ? badgeCountdown.toString() : ""
    });
    chrome.action.setBadgeBackgroundColor({ color: "#f7f9f9" });
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
        const { tabId, interval } = message;
        setTabInterval(tabId, interval); // Set the interval for the specific tab
        sendResponse({ success: true });
        if (isCycling) {
            stopCycling();
            startCycling();
        }
        sendResponse({ success: true });
      }
    sendResponse({ success: true });
});

// Tab Scheduling
function padTime(num) {
    return num.toString().padStart(2, '0');
}
  
function scheduleTabs(alarm) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
    const currentTime = `${padTime(now.getHours())}:${padTime(now.getMinutes())}`;
    
    const match = alarm.name.match(/^tab-(\d+)-(\d)$/);
    if (!match) return;

    const index = parseInt(match[1]);

    chrome.storage.local.get("schedules", (res) => {
        const entry = res.schedules?.[index];

            if (entry) {
                if (entry.autoclose > 0) {
                    // Pause cycling
                    if (isCycling) {
                        stopCycling();
                        cyclingPaused = true;
                    }
                }
                if (
                    entry.enabled &&
                    entry.days.includes(currentDay) &&
                    entry.time === currentTime
                ) {

                    const [hour, minute] = entry.time.split(":").map(Number);
                    chrome.tabs.create({ url: entry.url, active: entry.focus || false}, (tab) => {
                        if (entry.autoclose > 0) {
                            const alarmName = `autoclose-${tab.id}`;
                            const alarmDate = new Date(now);
                            alarmDate.setDate(now.getDate());
                            alarmDate.setHours(hour, minute, entry.autoclose, 0);
                            chrome.alarms.create(alarmName, {
                                when: alarmDate.getTime()
                            });
                            if (entry.autodisable) {
                                const disableAlarmName = `autodisable-${index}`;
                                chrome.alarms.create(disableAlarmName, {
                                    when: alarmDate.getTime()
                                });
                            }
                        } else {
                            if (entry.autoclose <= 0 && entry.cycleInterval && entry.cycleInterval > 0) {
                                chrome.storage.local.get("tabIntervals", (res) => {
                                    const updatedIntervals = res.tabIntervals || {};
                                    updatedIntervals[tab.id] = entry.cycleInterval;
                                    chrome.storage.local.set({ tabIntervals: updatedIntervals });
                                    
                                    stopCycling();
                                    startCycling();
                                });
                            }
                        }
                    });
                }
        }});    
    }
        
function setupAlarms() {
    chrome.alarms.clearAll(() => {
    chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];

        schedules.forEach((entry, index) => {
            if (!entry.enabled || !entry.days?.length || !entry.time) return;

            const now = new Date();
            const [hour, minute] = entry.time.split(":").map(Number);

            for (let i = 0; i < 7; i++) {
                const alarmDay = (now.getDay() + i) % 7;
                if (entry.days.includes(alarmDay)) {
                    const alarmDate = new Date(now);
                    alarmDate.setDate(now.getDate() + i);
                    alarmDate.setHours(hour, minute, 0, 0);

                    if (alarmDate > now) {
                        chrome.alarms.create(`tab-${index}-${alarmDay}`, {
                            when: alarmDate.getTime()
                        });
                        break; // Only schedule the next closest time
                    }
                }
            }
            });
        });
    });
}

chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);
chrome.storage.onChanged.addListener(setupAlarms);

chrome.alarms.onAlarm.addListener((alarm) => {
    scheduleTabs(alarm)
    console.log(`[autoclose] Alarm triggered: ${alarm.name}`);
    const match = alarm.name.match(/^autoclose-(\d+)$/);
    if (match) {
        const tabId = parseInt(match[1]);
        chrome.tabs.remove(tabId).then(() => {
            console.log(`[autoclose] Removed tab ${tabId}`);
        }).catch((err) => {
            console.warn(`[autoclose] Failed to remove tab ${tabId}:`, err);
        });

        if (cyclingPaused) {
            console.log("[autoclose] Resuming cycling...");
            startCycling();
            cyclingPaused = false;
        }
    }
    const disableMatch = alarm.name.match(/^autodisable-(\d+)$/);
    if (disableMatch) {
        const index = parseInt(disableMatch[1]);
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            if (schedules[index]) {
                schedules[index].enabled = false;
                chrome.storage.local.set({ schedules }, () => {
                    console.log(`[autodisable] Disabled schedule at index ${index}`);
                });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "previewNow") {
        chrome.storage.local.get("schedules", (res) => {
            res.schedules?.forEach((schedule) => {
                chrome.tabs.create({ url: schedule.url });
            });
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "setTabInterval") {
        const { tabId, interval } = message;
        setTabInterval(tabId, interval); // Update the interval for the specific tab
        sendResponse({ success: true });

        // If cycling is active, restart it with the new intervals
        if (isCycling) {
            stopCycling();
            startCycling();
        }
    }
    sendResponse({ success: true });
});