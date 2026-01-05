const scheduleList = document.getElementById("schedule-list");
const addButton = document.getElementById("add-schedule");
const saveAllButton = document.getElementById("save-all");

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const tabIntervalsBody = document.getElementById("tab-intervals-body");

// Page Navigation
function initPageNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.settings-page');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetPage = this.getAttribute('data-page');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Show target page, hide others
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `page-${targetPage}`) {
                    page.classList.add('active');
                }
            });
        });
    });
}

window.addEventListener('load', function() {
    // Initialize page navigation
    initPageNavigation();
    chrome.storage.local.get(["schedules", "scrollPosition", "reloadTabOnCycle", "autoStartOnStartup", "skipPinnedTabs"], (res) => {
        const savedScrollPosition = res.scrollPosition;

        // Load general settings
        const reloadTabToggle = document.getElementById("reload-tab-toggle");
        const autoStartToggle = document.getElementById("auto-start-toggle");
        const skipPinnedToggle = document.getElementById("skip-pinned-toggle");

        if (reloadTabToggle) {
            reloadTabToggle.checked = res.reloadTabOnCycle || false;
            reloadTabToggle.addEventListener("change", () => {
                chrome.storage.local.set({ reloadTabOnCycle: reloadTabToggle.checked }, () => {
                    showSavedMessage();
                })
            });
        }
        if (autoStartToggle) {
            autoStartToggle.checked = res.autoStartOnStartup || false;
            autoStartToggle.addEventListener("change", () => {
                chrome.storage.local.set({ autoStartOnStartup: autoStartToggle.checked }, () => {
                    showSavedMessage();
                })
            });
        }
        if (skipPinnedToggle) {
            skipPinnedToggle.checked = res.skipPinnedTabs || false;
            skipPinnedToggle.addEventListener("change", () => {
                chrome.storage.local.set({ skipPinnedTabs: skipPinnedToggle.checked }, () => {
                    showSavedMessage();
                    // If cycling is active, restart it to apply the new setting
                    chrome.runtime.sendMessage({ action: "restartCycling" });
                })
            });
        }
        // Restore the page scroll position
        window.scrollTo(0, savedScrollPosition);

        // Schedules
        const schedules = res.schedules || [];
        if (schedules.length === 0) {
            const scheduleBody = document.querySelector("#schedule-body");
            const noTabsRow = document.createElement("tr");
        const noTabsCell = document.createElement("td");
        noTabsCell.colSpan = 6;
        noTabsCell.className = "no-schedule-cell";
        noTabsCell.textContent = chrome.i18n.getMessage("noTabsScheduledOptions");
            noTabsRow.appendChild(noTabsCell);
            scheduleBody.appendChild(noTabsRow);
        } else {
            schedules.forEach((sched, i) => createScheduleEntry(sched, i)); // Create schedule entries
        }
        loadTabIntervals();
    });  
});

function updateNoTabsMessage() {
    const scheduleBody = document.querySelector("#schedule-body");
    const existingMsg = scheduleBody.querySelector(".no-schedule-row");

    const rows = scheduleBody.querySelectorAll("tr:not(.no-schedule-row)");
    const hasTabs = rows.length > 0;

    if (!hasTabs && !existingMsg) {
        const noTabsRow = document.createElement("tr");
        noTabsRow.className = "no-schedule-row";

        const noTabsCell = document.createElement("td");
        noTabsCell.colSpan = 6;
        noTabsCell.textContent = chrome.i18n.getMessage("noTabsScheduledOptions");
        noTabsCell.style.textAlign = "center";
        noTabsCell.style.padding = "12px";
        noTabsCell.style.color = "#000";

        noTabsRow.appendChild(noTabsCell);
        scheduleBody.appendChild(noTabsRow);
    } else if (hasTabs && existingMsg) {
        existingMsg.remove();
    }
}

function loadTabIntervals() {
    chrome.tabs.query({}, (tabs) => {
        chrome.storage.local.get(["tabIntervals", "intervalSeconds"], (res) => {
            const tabIntervals = res.tabIntervals || {};
            const defaultInterval = res.intervalSeconds || 15; // Default to 15 if not set

            tabs.forEach(tab => {
                const row = document.createElement("tr");

                // Active (favicon + active status)
                const activeCell = document.createElement("td");
                const favicon = document.createElement("img");
                favicon.src = tab.favIconUrl || "";
                favicon.style.width = "16px";
                favicon.style.height = "16px";
                favicon.style.verticalAlign = "middle";
                activeCell.appendChild(favicon);
                row.appendChild(activeCell);

                // Title
                const titleCell = document.createElement("td");
                titleCell.textContent = tab.title || chrome.i18n.getMessage("untitled");
                row.appendChild(titleCell);

                // URL
                const urlCell = document.createElement("td");

                const urlText = document.createElement("span");
                urlText.textContent = tab.url || "";
                urlText.title = tab.url || "";
                urlText.style.display = "inline-block";
                urlText.style.maxWidth = "250px";
                urlText.style.overflow = "hidden";
                urlText.style.textOverflow = "ellipsis";
                urlText.style.whiteSpace = "nowrap";
                urlText.style.cursor = "pointer";
                urlCell.style.wordBreak = "break-all";
                
                urlText.addEventListener("click", () => {
                  const isCollapsed = urlText.style.whiteSpace === "nowrap";
                  urlText.style.whiteSpace = isCollapsed ? "normal" : "nowrap";
                  urlText.style.maxWidth = isCollapsed ? "unset" : "250px";
                });
                
                urlCell.appendChild(urlText);
                row.appendChild(urlCell);

                // Cycle Interval input
                const intervalCell = document.createElement("td");
                const intervalInput = document.createElement("input");
                intervalInput.type = "number";
                intervalInput.min = "1";
                intervalInput.placeholder = chrome.i18n.getMessage("secondsUnit");
                // Use custom interval if exists, otherwise use default interval
                const customInterval = tabIntervals[tab.id]?.value;
                intervalInput.value = customInterval !== undefined ? customInterval : defaultInterval;
                intervalInput.style.width = "80px";

                intervalInput.addEventListener("input", debounce(() => {
                    chrome.storage.local.get("tabIntervals", (res) => {
                        const updatedIntervals = res.tabIntervals || {};
                        const newInterval = parseInt(intervalInput.value);
                        if (isNaN(newInterval) || newInterval <= 0) {
                            delete updatedIntervals[tab.id];
                        } else {
                            updatedIntervals[tab.id] = { value: newInterval, manual: true };
                        }
                        chrome.storage.local.set({ tabIntervals: updatedIntervals }, () => {
                            showSavedMessage();
                        });
                    });
                }, 500));

                intervalCell.appendChild(intervalInput);
                row.appendChild(intervalCell);

                tabIntervalsBody.appendChild(row);
            });
        });
    });
}

function showSavedMessage() {
    const toast = document.getElementById("toast");
    toast.classList.add("show");

    clearTimeout(showSavedMessage.timeout);
    showSavedMessage.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 1500); // 1.5 seconds visible before fade out
}


function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

function createScheduleEntry(data = {
        enabled: true,
        name: "",
        url: "",
        time: "08:00",
        days: [],
        autoclose: 0,
        autodisable: false,
        repeat: false,         
        repeatEvery: 0,        
        repeatUnit: "minutes", 
        focus: false,
        autoStartCycling: false,
        cycleInterval: 0,
        lastOpened: 0,
        hasOpenedOnce: false

    }, index = null) {
    const row = document.createElement("tr");
        
    // Active toggle
    const activeCell = document.createElement("td");
    const toggleEnabled = document.createElement("label");
    toggleEnabled.className = "switch";
    toggleEnabled.innerHTML = `
        <input type="checkbox" ${data.enabled ? "checked" : ""}>
        <span class="slider"></span>
    `;
    activeCell.appendChild(toggleEnabled);
    row.appendChild(activeCell);

    // Name
    const nameCell = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = chrome.i18n.getMessage("tabName");
    nameInput.value = data.name || "";
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);

    // URL
    const urlCell = document.createElement("td");
    const urlContainer = document.createElement("div");
    urlContainer.className = "url-input-container";
    
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = chrome.i18n.getMessage("urlPlaceholder");
    urlInput.value = data.url || "";
    
    // URL validation
    urlInput.addEventListener("input", () => {
        try {
            new URL(urlInput.value);
            urlInput.classList.remove("invalid");
            urlInput.classList.add("valid");
        } catch {
            urlInput.classList.add("invalid");
            urlInput.classList.remove("valid");
        }
        updateSchedule();
    });
    
    // Open-in-tab button
    const openLinkBtn = document.createElement("button");
    openLinkBtn.className = "url-launch";
    openLinkBtn.textContent = "🔗";
    openLinkBtn.title = chrome.i18n.getMessage("openThisUrl");
    openLinkBtn.onclick = () => {
        if (urlInput.value) {
            chrome.tabs.create({ url: urlInput.value });
        }
    };
    
    urlContainer.appendChild(urlInput);
    urlContainer.appendChild(openLinkBtn);
    urlCell.appendChild(urlContainer);
    row.appendChild(urlCell);

    // Time & Details
    const timeCell = document.createElement("td");

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = data.time;

    const daysDiv = document.createElement("div");
    daysDiv.className = "days";
    weekdays.forEach((day, i) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = data.days.includes(i);
        checkbox.dataset.index = i;
        label.appendChild(checkbox);
        label.append(" " + day);
        daysDiv.appendChild(label);
    });

    const autofocusLabel = document.createElement("label");
    const autofocusInput = document.createElement("input");
    autofocusInput.type = "checkbox";
    autofocusInput.checked = data.focus;
    autofocusLabel.appendChild(autofocusInput);
    autofocusLabel.append(" " + chrome.i18n.getMessage("autofocusTabAfterOpening"));

    const autoStartLabel = document.createElement("label");
    const autoStartInput = document.createElement("input");
    autoStartInput.type = "checkbox";
    autoStartInput.checked = data.autoStartCycling || false;
    autoStartLabel.appendChild(autoStartInput);
    autoStartLabel.append(" " + chrome.i18n.getMessage("autoStartCyclingAfterOpening"));

    const autodisableLabel = document.createElement("label");
    const autodisableInput = document.createElement("input");
    autodisableInput.type = "checkbox";
    autodisableInput.checked = data.autodisable;
    autodisableLabel.appendChild(autodisableInput);
    autodisableLabel.append(" " + chrome.i18n.getMessage("disableScheduleAfterOpening"));

    timeCell.appendChild(timeInput);
    timeCell.appendChild(daysDiv);
    timeCell.appendChild(autofocusLabel);
    timeCell.appendChild(autoStartLabel);
    timeCell.appendChild(autodisableLabel);

    // Repeat Options
    const repeatContainer = document.createElement("div");
    repeatContainer.className = "repeat-container";
    
    const repeatLabel = document.createElement("label");
    const repeatInput = document.createElement("input");
    repeatInput.type = "checkbox";
    repeatInput.checked = data.repeat;
    repeatLabel.appendChild(repeatInput);
    repeatLabel.append(" " + chrome.i18n.getMessage("repeat"));
    
    const repeatEveryInput = document.createElement("input");
    repeatEveryInput.type = "number";
    repeatEveryInput.min = "1";
    repeatEveryInput.placeholder = chrome.i18n.getMessage("interval");
    repeatEveryInput.value = data.repeatEvery || "";
    
    const repeatUnitSelect = document.createElement("select");
    const units = [
        { value: "seconds", key: "secondsUnit" },
        { value: "minutes", key: "minutes" },
        { value: "hours", key: "hours" },
        { value: "days", key: "days" }
    ];
    units.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit.value;
        option.textContent = chrome.i18n.getMessage(unit.key);
        if (data.repeatUnit === unit.value) option.selected = true;
        repeatUnitSelect.appendChild(option);
    });
    
    // ➔ Group repeatLabel, repeatEveryInput, repeatUnitSelect nicely together
    repeatContainer.appendChild(repeatLabel);
    repeatContainer.appendChild(repeatEveryInput);
    repeatContainer.appendChild(repeatUnitSelect);
    
    // ➔ Then finally add it to timeCell
    timeCell.appendChild(repeatContainer);

    row.appendChild(timeCell);

    // Auto-Close and Cycle Interval (combined in column 5)
    const autocloseCell = document.createElement("td");
    const inputsContainer = document.createElement("div");
    inputsContainer.style.display = "flex";
    inputsContainer.style.flexDirection = "column";
    inputsContainer.style.gap = "12px";
    
    // Auto-Close input with label
    const autocloseWrapper = document.createElement("div");
    autocloseWrapper.style.display = "flex";
    autocloseWrapper.style.flexDirection = "column";
    autocloseWrapper.style.width = "100%";
    
    const autocloseLabel = document.createElement("label");
    autocloseLabel.textContent = chrome.i18n.getMessage("autoCloseLabel");
    autocloseLabel.style.fontSize = "0.875rem";
    autocloseLabel.style.marginBottom = "4px";
    autocloseLabel.style.color = "#333";
    
    const autocloseInput = document.createElement("input");
    autocloseInput.type = "number";
    autocloseInput.placeholder = chrome.i18n.getMessage("secondsUnit");
    autocloseInput.value = data.autoclose || 0;
    autocloseInput.style.width = "100%";
    autocloseLabel.setAttribute("for", `autoclose-${index !== null ? index : Date.now()}`);
    autocloseInput.id = `autoclose-${index !== null ? index : Date.now()}`;
    
    autocloseWrapper.appendChild(autocloseLabel);
    autocloseWrapper.appendChild(autocloseInput);
    inputsContainer.appendChild(autocloseWrapper);
    
    // Cycle Interval input with label
    const cycleIntervalWrapper = document.createElement("div");
    cycleIntervalWrapper.style.display = "flex";
    cycleIntervalWrapper.style.flexDirection = "column";
    cycleIntervalWrapper.style.width = "100%";
    
    const cycleIntervalLabel = document.createElement("label");
    cycleIntervalLabel.textContent = chrome.i18n.getMessage("cycleIntervalLabel");
    cycleIntervalLabel.style.fontSize = "0.875rem";
    cycleIntervalLabel.style.marginBottom = "4px";
    cycleIntervalLabel.style.color = "#333";
    
    const cycleIntervalInput = document.createElement("input");
    cycleIntervalInput.type = "number";
    cycleIntervalInput.placeholder = chrome.i18n.getMessage("secondsUnit");
    cycleIntervalInput.value = data.cycleInterval || 0;  // Default to 0 if no interval is provided
    cycleIntervalInput.style.width = "100%";
    cycleIntervalLabel.setAttribute("for", `cycleInterval-${index !== null ? index : Date.now()}`);
    cycleIntervalInput.id = `cycleInterval-${index !== null ? index : Date.now()}`;
    
    cycleIntervalWrapper.appendChild(cycleIntervalLabel);
    cycleIntervalWrapper.appendChild(cycleIntervalInput);
    inputsContainer.appendChild(cycleIntervalWrapper);
    
    autocloseCell.appendChild(inputsContainer);
    autocloseCell.style.width = "160px";
    autocloseCell.style.minWidth = "160px";

    row.appendChild(autocloseCell);

    const save = (index, updatedEntry) => {
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            if (index !== null) {
                schedules[index] = updatedEntry; // Update existing schedule
            } else {
                schedules.push(updatedEntry); // Add new schedule
            }
            chrome.storage.local.set({ schedules }, () => {
                showSavedMessage();
                
                // Notify background.js to update cycling behavior
                chrome.runtime.sendMessage({
                    action: "setTabInterval",
                    tabId: tab.id,
                    interval: { value: newInterval, manual: true }
                });
            });
        });
    }
    
    const debouncedSave = debounce((index, updatedEntry) => {
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
    
            // Defensive check
            if (index != null && index < schedules.length) {
                schedules[index] = updatedEntry;
            }
            chrome.storage.local.set({ 
                schedules, 
                
            }, () => {
                showSavedMessage();

                chrome.runtime.sendMessage({ action: "refreshAlarms" });
            });
        });
    }, 1000);

    // Event listeners for automatic saving
    const updateSchedule = () => {
        const days = [...daysDiv.querySelectorAll("input:checked")].map(cb => parseInt(cb.dataset.index));
        const newData = {
            url: urlInput.value,
            name: nameInput.value,
            time: timeInput.value,
            days,
            autoclose: parseInt(autocloseInput.value) || 0,
            enabled: toggleEnabled.querySelector("input").checked,
            focus: autofocusInput.checked,
            autoStartCycling: autoStartInput.checked,
            autodisable: autodisableInput.checked,
            cycleInterval: parseInt(cycleIntervalInput.value) || 0,  // Include cycle interval here
            repeat: repeatInput.checked,
            repeatEvery: parseInt(repeatEveryInput.value) || 0,
            repeatUnit: repeatUnitSelect.value || "minutes",
            lastOpened: data.lastOpened || 0,
            hasOpenedOnce: data.hasOpenedOnce || false
        };
        
        debouncedSave(index, newData);
    };

    // Add event listeners to inputs
    nameInput.addEventListener("input", updateSchedule);
    urlInput.addEventListener("input", updateSchedule);
    timeInput.addEventListener("input", updateSchedule);
    autocloseInput.addEventListener("input", updateSchedule);
    autofocusInput.addEventListener("change", updateSchedule);
    autoStartInput.addEventListener("change", updateSchedule);
    autodisableInput.addEventListener("change", updateSchedule);
    cycleIntervalInput.addEventListener("input", updateSchedule);
    repeatInput.addEventListener("change", updateSchedule);
    repeatEveryInput.addEventListener("input", updateSchedule);
    repeatUnitSelect.addEventListener("change", updateSchedule);
    daysDiv.querySelectorAll("input").forEach(checkbox => {
        checkbox.addEventListener("change", updateSchedule);
    });
    toggleEnabled.querySelector("input").addEventListener("change", updateSchedule);

    // Action buttons (open + delete)
    const actionCell = document.createElement("td");

    // Open Button
    const openBtn = document.createElement("button");
    openBtn.textContent = chrome.i18n.getMessage("open");
    openBtn.title = chrome.i18n.getMessage("openThisTabNow");
    openBtn.style.marginBottom = "6px";

    openBtn.addEventListener("click", () => {
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            if (index !== null) {
                const entry = schedules[index];
                chrome.tabs.create({ url: entry.url, active: entry.focus || false });
            }
        });
    });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = chrome.i18n.getMessage("delete");
    deleteBtn.title = chrome.i18n.getMessage("deleteTitle");
    deleteBtn.style.backgroundColor = "#dc3545"; // Bootstrap-style red
    deleteBtn.style.color = "white";
    deleteBtn.style.border = "none";
    deleteBtn.style.padding = "6px 12px";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.cursor = "pointer";

    deleteBtn.onmouseover = () => {
        deleteBtn.style.backgroundColor = "#c82333"; // darker red on hover
    };

    deleteBtn.onmouseout = () => {
        deleteBtn.style.backgroundColor = "#dc3545";
    };

    deleteBtn.onclick = () => {
        const row = deleteBtn.closest("tr");
        if (row) row.remove();
    
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            if (index !== null && index < schedules.length) {
                schedules.splice(index, 1);
                chrome.storage.local.set({ schedules }, () => {
                    showSavedMessage();
                    chrome.runtime.sendMessage({ action: "refreshAlarms" });
                });
            }
        });
        updateNoTabsMessage();
    };

    actionCell.appendChild(openBtn);
    actionCell.appendChild(deleteBtn);
    row.appendChild(actionCell);

    document.querySelector("#schedule-body").appendChild(row);
}

addButton.onclick = () => {
    chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];
        schedules.push({
            enabled: true,
            name: "",
            url: "",
            time: "08:00",
            days: [],
            autoclose: 0,
            autodisable: false,
            focus: false,
            autoStartCycling: false
        });
        chrome.storage.local.set({ schedules }, () => {
            createScheduleEntry(schedules[schedules.length - 1], schedules.length - 1);
            showSavedMessage();

            const newRow = document.querySelector("#schedule-body tr:last-child");
            if (newRow) newRow.scrollIntoView({ behavior: "smooth", block: "center" });
            updateNoTabsMessage();
        });
    });
};

saveAllButton.onclick = () => {
    const rows = document.querySelectorAll("#schedule-body tr");
    const updatedSchedules = [];

    rows.forEach(row => {
        const enabled = row.querySelector("td:nth-child(1) input").checked;
        const name = row.querySelector("td:nth-child(2) input").value;
        const url = row.querySelector("td:nth-child(3) input").value;
        const time = row.querySelector("td:nth-child(4) input[type='time']").value;
        const fourthTd = row.querySelector("td:nth-child(4)");
        const checkboxes = fourthTd.querySelectorAll("input[type='checkbox']");
        const dayCheckboxes = row.querySelectorAll("td:nth-child(4) .days input[type='checkbox']");
        const days = [...dayCheckboxes].filter(cb => cb.checked).map(cb => parseInt(cb.dataset.index));
        // Checkboxes order: autofocus, autoStartCycling, autodisable, repeat
        const focus = checkboxes[0]?.checked || false;
        const autoStartCycling = checkboxes[1]?.checked || false;
        const autodisable = checkboxes[2]?.checked || false;
        const repeat = checkboxes[3]?.checked || false;
        const repeatEveryInput = fourthTd.querySelector("input[type='number']");
        const repeatEvery = parseInt(repeatEveryInput?.value) || 0;
        const repeatUnitSelect = fourthTd.querySelector("select");
        const repeatUnit = repeatUnitSelect?.value || "minutes";
        const fifthTd = row.querySelector("td:nth-child(5)");
        const inputs = fifthTd.querySelectorAll("input[type='number']");
        const autoclose = parseInt(inputs[0]?.value) || 0;
        const cycleInterval = parseInt(inputs[1]?.value) || 0;  // Get cycle interval value
        updatedSchedules.push({
            enabled, name, url, time, days,
            autoclose, focus, autoStartCycling, autodisable, cycleInterval,
            repeat, repeatEvery, repeatUnit
        });
    });
    
    chrome.storage.local.set({ 
        schedules: updatedSchedules,
        
    }, () => {
        showSavedMessage();
    });
};