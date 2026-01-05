// Tab Cycling
let intervalId = null;
let timeoutId = null;
let intervalSeconds = 15; // Default value
let isCycling = false;
let cyclingPaused = false;
let badgeIntervalId = null;
let badgeCountdown = 0;
let cycleStartTime = null;
let tabIntervals = {}; // To store the interval for each tab
let targetWindowId = "active"; // default
 
chrome.storage.local.get(["selectedWindowId"], (res) => {
    targetWindowId = res.selectedWindowId || "active";
});

chrome.storage.local.get("intervalSeconds", (res) => {
    if (typeof res.intervalSeconds === "undefined") {
      chrome.storage.local.set({ intervalSeconds });
    } else {
      intervalSeconds = res.intervalSeconds;
    }
  });
  
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({
            url: chrome.runtime.getURL('onboarding.html')
        });
    } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.tabs.create({
            url: chrome.runtime.getURL('update.html')
        });
    }
});

function updateInterval(newInterval) {
    intervalSeconds = newInterval;
    chrome.storage.local.set({ intervalSeconds }); // Save to storage
}

// Function to cycle through tabs
async function cycleTabs() {
    const result = await chrome.storage.local.get(["targetWindowId", "skipPinnedTabs"]);
    let query = {};

    // Use specific window if chosen
    if (result.targetWindowId && result.targetWindowId !== "active") {
        query.windowId = parseInt(result.targetWindowId);
    } else {
        query.currentWindow = true;
    }

    let tabs = await chrome.tabs.query(query);
    
    // Filter out pinned tabs if the setting is enabled
    if (result.skipPinnedTabs) {
        tabs = tabs.filter(tab => !tab.pinned);
    }
    
    // If no tabs remain after filtering, stop cycling
    if (tabs.length === 0) {
        stopCycling();
        return;
    }
    
    const activeTab = tabs.find(tab => tab.active);
    
    // If active tab was filtered out, use the first tab
    const currentTab = activeTab || tabs[0];

    // Ensure that we're staying on the active tab for the full interval
    const interval = tabIntervals[currentTab.id]?.value ?? intervalSeconds;
    const currentTabIndex = tabs.findIndex(tab => tab.id === currentTab.id);
    const nextTabIndex = (currentTabIndex + 1) % tabs.length;
    const nextTab = tabs[nextTabIndex];

    // Clear any previous timeout
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    // Update badge countdown and set the timeout for the next tab
    badgeCountdown = interval;
    updateBadge();

    // Wait for the cycle interval to expire before switching to the next tab
    timeoutId = setTimeout(async () => {
        chrome.tabs.update(nextTab.id, { active: true });

        chrome.storage.local.get("reloadTabOnCycle", (res) => {
            if (res.reloadTabOnCycle) {
                chrome.tabs.reload(nextTab.id);
            }
        });
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
                16: "assets/icons/pause16.png",
                48: "assets/icons/pause48.png",
                128: "assets/icons/pause128.png"
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
        16: "assets/icons/play16.png",
        48: "assets/icons/play48.png",
        128: "assets/icons/play128.png"
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
        intervalSeconds = message.interval ?? intervalSeconds;
        startCycling();
        sendResponse({ success: true });
    } else if (message.command === "stop") {
        stopCycling();
        sendResponse({ success: true });
    } else if (message.action === "setInterval") {
        updateInterval(message.value);
        const { tabId, interval } = message;
        setTabInterval(tabId, interval); // Set the interval for the specific tab
        if (isCycling) {
            stopCycling();
            startCycling();
        }
        sendResponse({ success: true });
    } else {
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
});

// Tab Scheduling
function padTime(num) {
    return num.toString().padStart(2, '0');
}

// Helper function to compare time strings properly (HH:MM format)
function compareTime(time1, time2) {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    return minutes1 - minutes2;
}
  
function scheduleTabs(alarm) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
    const currentTime = `${padTime(now.getHours())}:${padTime(now.getMinutes())}`;
    
    const match = alarm.name.match(/^tab-(\d+)-(\d)$/);
    if (!match) return;

    const index = parseInt(match[1]);

    chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];
        const entry = res.schedules?.[index];
        if (!entry) return;
        
        // Check if this schedule should fire now
        const isScheduledTime = entry.enabled && 
            entry.days && entry.days.length > 0 && 
            entry.days.includes(currentDay) && 
            entry.time === currentTime;
        
        const isRepeatAndReady = entry.enabled && 
            entry.repeat && 
            (!entry.days || entry.days.length === 0 || entry.days.includes(currentDay)) &&
            (!entry.time || compareTime(entry.time, currentTime) <= 0);
        
        if (!isScheduledTime && !isRepeatAndReady) {
            // This alarm shouldn't fire now, reschedule it properly
            rescheduleNextOccurrence(index, entry);
            return;
        }
        
        // Set first-open flags
        entry.hasOpenedOnce = true;
        entry.lastOpenedTime = Date.now();

        if (entry.autoclose > 0) {
            // Pause cycling
            if (isCycling) {
                stopCycling();
                cyclingPaused = true;
            }
        }
        
        const [hour, minute] = entry.time ? entry.time.split(":").map(Number) : [now.getHours(), now.getMinutes()];
        
        // Create the repeat alarm if needed (only for initial scheduled time, not repeat alarms)
        if (isScheduledTime && entry.repeat && entry.repeatEvery > 0) {
            let repeatInMinutes = 0;
            switch (entry.repeatUnit) {
                case "seconds":
                    repeatInMinutes = entry.repeatEvery / 60;
                    break;
                case "minutes":
                    repeatInMinutes = entry.repeatEvery;
                    break;
                case "hours":
                    repeatInMinutes = entry.repeatEvery * 60;
                    break;
                case "days":
                    repeatInMinutes = entry.repeatEvery * 1440;
                    break;
            }

            if (repeatInMinutes >= 1 / 60) {
                chrome.alarms.create(`repeat-tab-${index}`, {
                    periodInMinutes: repeatInMinutes,
                    delayInMinutes: repeatInMinutes
                });
                console.log(`Created repeat-tab-${index} with ${repeatInMinutes}min interval`);
            }
        }

        chrome.storage.local.set({ schedules });
        
        chrome.tabs.create({ url: entry.url, active: entry.focus || false}, (tab) => {
            if (entry.autoclose > 0) {
                const alarmName = `autoclose-${tab.id}`;
                // Add autoclose seconds to current time
                const alarmDate = new Date(now.getTime() + (entry.autoclose * 1000));
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
                if (entry.cycleInterval && entry.cycleInterval > 0) {
                    chrome.storage.local.get("tabIntervals", (res) => {
                        const updatedIntervals = res.tabIntervals || {};
                        if (entry.cycleInterval && entry.cycleInterval > 0) {
                            updatedIntervals[tab.id] = {
                              value: entry.cycleInterval,
                              manual: false
                            };
                            tabIntervals[tab.id] = updatedIntervals[tab.id];
                            chrome.storage.local.set({ tabIntervals: updatedIntervals });
                          }
                        
                        if (isCycling) {
                            stopCycling();
                            startCycling();
                        }
                    });
                }
            }
        });
        
        // Reschedule the next occurrence for non-repeat schedules
        if (!entry.repeat || !entry.repeatEvery) {
            rescheduleNextOccurrence(index, entry);
        }
    });    
}

// Helper function to reschedule the next occurrence of a schedule
function rescheduleNextOccurrence(index, entry) {
    if (!entry.enabled || !entry.days?.length || !entry.time) return;
    
    const now = new Date();
    const [hour, minute] = entry.time.split(":").map(Number);
    
    // Find the next matching day (check up to 14 days to handle week wrap-around)
    for (let i = 0; i < 14; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + i);
        checkDate.setHours(hour, minute, 0, 0);
        const alarmDay = checkDate.getDay();
        
        if (entry.days.includes(alarmDay) && checkDate > now) {
            chrome.alarms.create(`tab-${index}-${alarmDay}`, {
                when: checkDate.getTime()
            });
            break; // Only schedule the next closest time
        }
    }
}
        
function setupAlarms() {
    chrome.alarms.clearAll(() => {
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];

            schedules.forEach((entry, index) => {
                if (!entry.enabled) return;
                
                // For repeat schedules, create the repeat alarm if needed
                if (entry.repeat && entry.repeatEvery > 0 && entry.days?.length && entry.time) {
                    const now = new Date();
                    const currentDay = now.getDay();
                    const currentTime = `${padTime(now.getHours())}:${padTime(now.getMinutes())}`;
                    const [hour, minute] = entry.time.split(":").map(Number);
                    
                    // Check if we should start the repeat alarm now or schedule initial alarm
                    if (entry.days.includes(currentDay)) {
                        const alarmDate = new Date(now);
                        alarmDate.setHours(hour, minute, 0, 0);
                        
                        if (alarmDate > now || (alarmDate <= now && compareTime(entry.time, currentTime) <= 0)) {
                            // Schedule the initial alarm or start repeat immediately
                            if (alarmDate > now) {
                                chrome.alarms.create(`tab-${index}-${currentDay}`, {
                                    when: alarmDate.getTime()
                                });
                            }
                        }
                    } else {
                        // Schedule the next occurrence
                        rescheduleNextOccurrence(index, entry);
                    }
                } else if (entry.days?.length && entry.time) {
                    // Normal daily/weekly scheduled tab - schedule next occurrence
                    rescheduleNextOccurrence(index, entry);
                }
            });
        });
    });
}

chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(() => {
    setupAlarms();

    chrome.storage.local.get("autoStartOnStartup", (res) => {
        if (res.autoStartOnStartup) { startCycling();}
    })
});
    
chrome.alarms.onAlarm.addListener((alarm) => {
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

    if (alarm.name.startsWith("tab-")) {
        scheduleTabs(alarm);
    }
    else if (alarm.name.startsWith("repeat-tab-")) {
        const match = alarm.name.match(/^repeat-tab-(\d+)$/);
        if (match) {
            const index = parseInt(match[1]);
            chrome.storage.local.get("schedules", (res) => {
                const entry = res.schedules?.[index];
                if (entry && entry.enabled) {
                    const now = new Date();
                    const currentDay = now.getDay();
                    const currentTime = `${padTime(now.getHours())}:${padTime(now.getMinutes())}`;
    
                    // Check if repeat should fire: either no day restriction or current day matches,
                    // and either no time restriction or current time is past the scheduled time
                    const dayMatches = !entry.days || entry.days.length === 0 || entry.days.includes(currentDay);
                    const timeMatches = !entry.time || compareTime(entry.time, currentTime) <= 0;
                    
                    if (dayMatches && timeMatches) {
                        // Update last opened time
                        entry.hasOpenedOnce = true;
                        entry.lastOpenedTime = Date.now();
                        chrome.storage.local.set({ schedules: res.schedules });
                        
                        chrome.tabs.create({ url: entry.url, active: entry.focus || false }, (tab) => {
                            if (entry.autoclose > 0) {
                                chrome.alarms.create(`autoclose-${tab.id}`, {
                                    when: Date.now() + (entry.autoclose * 1000)
                                });
                                // Pause cycling if autoclose is set
                                if (isCycling) {
                                    stopCycling();
                                    cyclingPaused = true;
                                }
                            }
                        
                            // Inject cycleInterval into tabIntervals
                            if (entry.cycleInterval && entry.cycleInterval > 0) {
                                chrome.storage.local.get("tabIntervals", (res) => {
                                    const updatedIntervals = res.tabIntervals || {};
                                    updatedIntervals[tab.id] = {
                                        value: entry.cycleInterval,
                                        manual: false
                                    };
                                    chrome.storage.local.set({ tabIntervals: updatedIntervals }, () => {
                                        if (isCycling) {
                                            stopCycling();
                                            startCycling();
                                        }
                                    });
                                });
                            } else {
                                if (isCycling) {
                                    stopCycling();
                                    startCycling();
                                }
                            }
                        });
                    }
                }
            });
        }
    }    
    
    
});

function getRepeatMs(value, unit) {
    if (!value || value <= 0) return 0;

    switch (unit) {
        case "seconds": return value * 1000;
        case "minutes": return value * 60 * 1000;
        case "hours": return value * 60 * 60 * 1000;
        case "days": return value * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "refreshAlarms") {
        console.log("Manual refreshAlarms requested.");
        setupAlarms();
        sendResponse({ success: true });
    } else if (message.action === "restartCycling") {
        if (isCycling) {
            stopCycling();
            startCycling();
        }
        sendResponse({ success: true });
    }
    return true;
});