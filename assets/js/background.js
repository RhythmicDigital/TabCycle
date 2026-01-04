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
  

function updateInterval(newInterval) {
    intervalSeconds = newInterval;
    chrome.storage.local.set({ intervalSeconds }); // Save to storage
}

// Function to cycle through tabs
async function cycleTabs() {
    const result = await chrome.storage.local.get("targetWindowId");
    let query = {};

    // Use specific window if chosen
    if (result.targetWindowId && result.targetWindowId !== "active") {
        query.windowId = parseInt(result.targetWindowId);
    } else {
        query.currentWindow = true;
    }

    const tabs = await chrome.tabs.query(query);
    const activeTab = tabs.find(tab => tab.active);

    // Ensure that we're staying on the active tab for the full interval
    const interval = tabIntervals[activeTab.id]?.value ?? intervalSeconds;
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

// Tab Scheduling - Using cron-based system
// Import later.js library for cron parsing
importScripts('assets/js/src/tools/later.js');

// Convert schedule format to cron expression
function scheduleToCron(entry) {
    if (!entry.time || !entry.days || entry.days.length === 0) {
        return null;
    }

    const [hour, minute] = entry.time.split(":").map(Number);
    
    // Convert days array (0-6, Sunday=0) to cron day format (1-7, Sunday=1 or 0)
    // later.js uses 1-7 where 1=Sunday, 7=Saturday
    const cronDays = entry.days.map(day => {
        // Convert from 0-6 (Sun-Sat) to 1-7 (Sun-Sat) for later.js
        return day === 0 ? 7 : day;
    }).join(",");

    // Build cron: minute hour dayOfMonth month dayOfWeek
    // For repeat schedules, we handle them differently
    if (entry.repeat && entry.repeatEvery > 0) {
        // For repeat schedules, create a cron that repeats every X minutes/hours/days
        let cron = "";
        switch (entry.repeatUnit) {
            case "seconds":
                // Cron doesn't support seconds, so use minutes with division
                if (entry.repeatEvery >= 60) {
                    const minutes = Math.floor(entry.repeatEvery / 60);
                    // If days are specified, include them
                    cron = entry.days && entry.days.length > 0 
                        ? `*/${minutes} * * * ${cronDays}` 
                        : `*/${minutes} * * * *`; // Every X minutes
                } else {
                    // For seconds < 60, we'll use 1 minute as minimum
                    cron = entry.days && entry.days.length > 0 
                        ? `* * * * ${cronDays}` 
                        : `* * * * *`; // Every minute
                }
                break;
            case "minutes":
                // If days are specified, include them
                cron = entry.days && entry.days.length > 0 
                    ? `*/${entry.repeatEvery} * * * ${cronDays}` 
                    : `*/${entry.repeatEvery} * * * *`; // Every X minutes
                break;
            case "hours":
                // If days are specified, include them
                cron = entry.days && entry.days.length > 0 
                    ? `${minute} */${entry.repeatEvery} * * ${cronDays}` 
                    : `${minute} */${entry.repeatEvery} * * *`; // Every X hours at :minute
                break;
            case "days":
                // For days, we use dayOfMonth pattern, but if specific days are set, use dayOfWeek
                if (entry.days && entry.days.length > 0) {
                    // Repeat on specific days of week
                    cron = `${minute} ${hour} * * ${cronDays}`;
                } else {
                    // Repeat every X days
                    cron = `${minute} ${hour} */${entry.repeatEvery} * *`;
                }
                break;
            default:
                cron = `${minute} ${hour} * * ${cronDays}`; // Default to specific days
        }
        return cron;
    } else {
        // Non-repeat: specific days and time
        return `${minute} ${hour} * * ${cronDays}`;
    }
}

// Convert schedule entry to job format for cron system
function scheduleToJob(entry, index) {
    const cron = scheduleToCron(entry);
    if (!cron) return null;

    // Generate a unique ID for this job (use index if no id exists)
    const id = entry.id || `schedule-${index}`;

    return {
        id: id,
        active: entry.enabled !== false,
        name: entry.name || entry.url || `Schedule ${index}`,
        urls: [entry.url],
        cron: cron,
        expression: cron, // Store cron as expression for display
        autoFocus: entry.focus || false,
        autoClose: entry.autoclose > 0,
        closeDelay: entry.autoclose || 500,
        cycleInterval: entry.cycleInterval || 0,
        autodisable: entry.autodisable || false,
        // Keep original schedule data for compatibility
        originalSchedule: entry
    };
}

// Create alarm using cron-based scheduling
function createScheduleAlarm(job) {
    if (!job || !job.active || !job.cron) return;

    try {
        later.date.localTime();
        const schedule = later.schedule(later.parse.cron(job.cron));
        const nextCron = schedule.next();

        if (nextCron && nextCron.getTime() > Date.now()) {
            chrome.alarms.create(job.id, { when: nextCron.getTime() });
            console.log(`Created alarm for ${job.name} at ${nextCron.toLocaleString()}`);
        } else {
            console.warn(`Invalid next date for ${job.name}:`, nextCron);
        }
    } catch (error) {
        console.error(`Error creating alarm for ${job.name}:`, error);
    }
}

// Run scheduled tab job
function runScheduledTab(job) {
    if (!job || !job.urls || job.urls.length === 0) return;

    const originalSchedule = job.originalSchedule;

    // Pause cycling if autoclose is set
    if (job.autoClose && originalSchedule && originalSchedule.autoclose > 0) {
        if (isCycling) {
            stopCycling();
            cyclingPaused = true;
        }
    }

    job.urls.forEach((url) => {
        chrome.tabs.query({}, (tabs) => {
            const existingTab = tabs.find((t) => t.url === url);
            
            if (existingTab) {
                // Tab exists, update it
                chrome.tabs.update(
                    existingTab.id,
                    { active: job.autoFocus },
                    (tab) => {
                        chrome.tabs.reload(tab.id, {}, () => {
                            handleTabCallback(job, tab.id);
                        });
                    }
                );
            } else {
                // Create new tab
                chrome.tabs.create(
                    { url: url, active: job.autoFocus },
                    (tab) => {
                        handleTabCallback(job, tab.id);
                    }
                );
            }
        });
    });
}

// Handle tab creation/update callback
function handleTabCallback(job, tabId) {
    setTimeout(() => {
        chrome.tabs.get(tabId, (tab) => {
            if (tab.status !== "complete") {
                setTimeout(() => handleTabCallback(job, tabId), 1000);
                return;
            }

            const originalSchedule = job.originalSchedule;

            // Handle autoclose
            if (job.autoClose && originalSchedule && originalSchedule.autoclose > 0) {
                const closeDelay = originalSchedule.autoclose * 1000;
                chrome.alarms.create(`autoclose-${tabId}`, {
                    when: Date.now() + closeDelay
                });

                // Handle autodisable
                if (originalSchedule.autodisable) {
                    chrome.alarms.create(`autodisable-${job.id}`, {
                        when: Date.now() + closeDelay
                    });
                }
            }

            // Handle cycle interval
            if (job.cycleInterval && job.cycleInterval > 0) {
                chrome.storage.local.get("tabIntervals", (res) => {
                    const updatedIntervals = res.tabIntervals || {};
                    updatedIntervals[tabId] = {
                        value: job.cycleInterval,
                        manual: false
                    };
                    tabIntervals[tabId] = updatedIntervals[tabId];
                    chrome.storage.local.set({ tabIntervals: updatedIntervals }, () => {
                        if (isCycling) {
                            stopCycling();
                            startCycling();
                        }
                    });
                });
            } else if (isCycling) {
                stopCycling();
                startCycling();
            }

            // Reschedule the alarm for next occurrence
            createScheduleAlarm(job);
        });
    }, 1000);
}

// Setup alarms from schedules
function setupAlarms() {
    chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];
        console.log(`Setting up alarms for ${schedules.length} schedules`);

        // Migrate: Assign IDs to schedules that don't have them
        let needsMigration = false;
        schedules.forEach((entry, index) => {
            if (!entry.id) {
                entry.id = crypto.randomUUID();
                needsMigration = true;
            }
        });
        if (needsMigration) {
            chrome.storage.local.set({ schedules });
        }

        // First, verify existing alarms and clear invalid ones
        chrome.alarms.getAll((alarms) => {
            const scheduleIds = schedules.map((entry, index) => entry.id || `schedule-${index}`);
            alarms.forEach((alarm) => {
                // Keep autoclose and autodisable alarms, but clear old schedule alarms
                if (!alarm.name.startsWith("autoclose-") && 
                    !alarm.name.startsWith("autodisable-") &&
                    !scheduleIds.includes(alarm.name) &&
                    !alarm.name.match(/^tab-\d+-\d$/) && // Old format
                    !alarm.name.match(/^repeat-tab-\d+$/)) { // Old format
                    chrome.alarms.clear(alarm.name);
                }
            });

            // Create/update alarms for all enabled schedules
            schedules.forEach((entry, index) => {
                if (!entry.enabled) {
                    // Clear alarm if schedule is disabled
                    const entryId = entry.id || `schedule-${index}`;
                    chrome.alarms.clear(entryId);
                    return;
                }

                const job = scheduleToJob(entry, index);
                if (job) {
                    // Check if alarm already exists
                    chrome.alarms.get(job.id, (existingAlarm) => {
                        if (!existingAlarm) {
                            // Alarm doesn't exist, create it
                            createScheduleAlarm(job);
                        } else {
                            // Alarm exists, verify it's still valid by checking next occurrence
                            try {
                                later.date.localTime();
                                const schedule = later.schedule(later.parse.cron(job.cron));
                                const nextCron = schedule.next();
                                
                                // If the existing alarm is in the past or more than 1 day off, recreate it
                                const timeDiff = Math.abs(existingAlarm.scheduledTime - nextCron.getTime());
                                if (existingAlarm.scheduledTime < Date.now() || timeDiff > 86400000) {
                                    chrome.alarms.clear(job.id);
                                    createScheduleAlarm(job);
                                }
                            } catch (error) {
                                console.error(`Error verifying alarm for ${job.name}:`, error);
                                // Recreate on error
                                chrome.alarms.clear(job.id);
                                createScheduleAlarm(job);
                            }
                        }
                    });
                }
            });
        });
    });
}

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
    setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarms();

    chrome.storage.local.get("autoStartOnStartup", (res) => {
        if (res.autoStartOnStartup) { startCycling();}
    })
});
    
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(`Alarm triggered: ${alarm.name}`);
    
    // Handle autoclose alarms
    const autocloseMatch = alarm.name.match(/^autoclose-(\d+)$/);
    if (autocloseMatch) {
        const tabId = parseInt(autocloseMatch[1]);
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
        return;
    }

    // Handle autodisable alarms
    const disableMatch = alarm.name.match(/^autodisable-(.+)$/);
    if (disableMatch) {
        const jobId = disableMatch[1];
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            const index = schedules.findIndex(s => (s.id || `schedule-${schedules.indexOf(s)}`) === jobId);
            if (index >= 0 && schedules[index]) {
                schedules[index].enabled = false;
                chrome.storage.local.set({ schedules }, () => {
                    console.log(`[autodisable] Disabled schedule at index ${index}`);
                    setupAlarms(); // Reschedule alarms
                });
            }
        });
        return;
    }

    // Handle scheduled tab alarms (cron-based)
    chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];
        let job = null;
        let jobIndex = -1;

        // Try to find by ID first
        for (let i = 0; i < schedules.length; i++) {
            const entry = schedules[i];
            const entryId = entry.id || `schedule-${i}`;
            if (entryId === alarm.name) {
                job = entry;
                jobIndex = i;
                break;
            }
        }

        // Fallback: try to find by old format (tab-X-Y or repeat-tab-X)
        if (!job) {
            const oldTabMatch = alarm.name.match(/^tab-(\d+)-(\d)$/);
            const oldRepeatMatch = alarm.name.match(/^repeat-tab-(\d+)$/);
            if (oldTabMatch || oldRepeatMatch) {
                const index = oldTabMatch ? parseInt(oldTabMatch[1]) : parseInt(oldRepeatMatch[1]);
                if (schedules[index]) {
                    job = schedules[index];
                    jobIndex = index;
                }
            }
        }

        if (job && jobIndex >= 0) {
            const jobConfig = scheduleToJob(job, jobIndex);
            if (jobConfig && jobConfig.active) {
                runScheduledTab(jobConfig);
            }
        } else {
            console.warn(`No schedule found for alarm: ${alarm.name}`);
        }
    });
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
    }
    return true; // Keep the message channel open for async response
});