const scheduleList = document.getElementById("schedule-list");
const addButton = document.getElementById("add-schedule");
const saveAllButton = document.getElementById("save-all");

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const tabIntervalsBody = document.getElementById("tab-intervals-body");

window.addEventListener('load', function() {
    chrome.storage.local.get(["schedules", "scrollPosition"], (res) => {
        const savedScrollPosition = res.scrollPosition;

        // Restore the page scroll position
        window.scrollTo(0, savedScrollPosition);

        const schedules = res.schedules || [];
        schedules.forEach((sched, i) => createScheduleEntry(sched, i)); // Create schedule entries
        loadTabIntervals();
    });  
});

function loadTabIntervals() {
    chrome.tabs.query({}, (tabs) => {
        chrome.storage.local.get("tabIntervals", (res) => {
            const tabIntervals = res.tabIntervals || {};

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
                titleCell.textContent = tab.title || "Untitled";
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
                intervalInput.placeholder = "Seconds";
                intervalInput.value = tabIntervals[tab.id] || "";
                intervalInput.style.width = "80px";

                intervalInput.addEventListener("input", debounce(() => {
                    chrome.storage.local.get("tabIntervals", (res) => {
                        const updatedIntervals = res.tabIntervals || {};
                        const newInterval = parseInt(intervalInput.value);
                        if (isNaN(newInterval) || newInterval <= 0) {
                            delete updatedIntervals[tab.id];
                        } else {
                            updatedIntervals[tab.id] = newInterval;
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
    nameInput.placeholder = "Tab Name";
    nameInput.value = data.name || "";
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);

    // URL
    const urlCell = document.createElement("td");
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "https://example.com";
    urlInput.value = data.url;
    urlCell.appendChild(urlInput);
    row.appendChild(urlCell);

    // Time & Details
    const timeCell = document.createElement("td");

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = data.time;
    timeInput.style.display = "block";

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
    autofocusLabel.append(" Autofocus");

    const autodisableLabel = document.createElement("label");
    const autodisableInput = document.createElement("input");
    autodisableInput.type = "checkbox";
    autodisableInput.checked = data.autodisable;
    autodisableLabel.appendChild(autodisableInput);
    autodisableLabel.append(" Autodisable");

    timeCell.appendChild(timeInput);
    timeCell.appendChild(daysDiv);
    timeCell.appendChild(autofocusLabel);
    timeCell.appendChild(autodisableLabel);

    // Repeat Options
    const repeatContainer = document.createElement("div");
    repeatContainer.className = "repeat-container";
    
    const repeatLabel = document.createElement("label");
    const repeatInput = document.createElement("input");
    repeatInput.type = "checkbox";
    repeatInput.checked = data.repeat;
    repeatLabel.appendChild(repeatInput);
    repeatLabel.append(" Repeat");
    
    const repeatEveryInput = document.createElement("input");
    repeatEveryInput.type = "number";
    repeatEveryInput.min = "1";
    repeatEveryInput.placeholder = "Interval";
    repeatEveryInput.value = data.repeatEvery || "";
    repeatEveryInput.style.width = "60px";
    repeatEveryInput.style.marginLeft = "10px";
    
    const repeatUnitSelect = document.createElement("select");
    ["seconds", "minutes", "hours", "days"].forEach(unit => {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1);
        if (data.repeatUnit === unit) option.selected = true;
        repeatUnitSelect.appendChild(option);
    });
    repeatUnitSelect.style.marginLeft = "5px";
    
    // ➔ Group repeatLabel, repeatEveryInput, repeatUnitSelect nicely together
    repeatContainer.appendChild(repeatLabel);
    repeatContainer.appendChild(repeatEveryInput);
    repeatContainer.appendChild(repeatUnitSelect);
    
    // ➔ Then finally add it to timeCell
    timeCell.appendChild(repeatContainer);

    row.appendChild(timeCell);

    // Auto-Close
    const autocloseCell = document.createElement("td");
    const autocloseInput = document.createElement("input");
    autocloseInput.type = "number";
    autocloseInput.placeholder = "Seconds";
    autocloseInput.value = data.autoclose || 0;
    autocloseInput.style.width = "50%";
    autocloseCell.appendChild(autocloseInput);
    autocloseCell.style.width = "90px";

    row.appendChild(autocloseCell);

    // Cycle Interval
    const cycleIntervalCell = document.createElement("td");
    const cycleIntervalInput = document.createElement("input");
    cycleIntervalInput.type = "number";
    cycleIntervalInput.placeholder = "Cycle Interval (s)";
    cycleIntervalInput.value = data.cycleInterval || 0;  // Default to 0 if no interval is provided
    cycleIntervalInput.style.width = "50%";
    cycleIntervalCell.appendChild(cycleIntervalInput);
    cycleIntervalCell.style.width = "90px";

    row.appendChild(cycleIntervalCell);

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
                    interval: newInterval
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
    openBtn.textContent = "Open";
    openBtn.title = "Open this tab now";
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
    deleteBtn.textContent = "X Delete";
    deleteBtn.title = "Delete";
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
        chrome.storage.local.get("schedules", (res) => {
            const schedules = res.schedules || [];
            if (index !== null) {
                schedules.splice(index, 1);

                chrome.storage.local.set({ 
                    schedules, 
                    scrollPosition: document.body.scrollTop
                }, () => location.reload());
            }
        });
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
            focus: false
        });
        chrome.storage.local.set({ 
            schedules, 
            scrollPosition: document.body.scrollTop
        }, () => {
            location.reload(); // Ensures the new entry is indexed properly
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
        const focus = checkboxes[checkboxes.length - 2].checked;
        const autodisable = checkboxes[checkboxes.length - 1].checked;
        const dayCheckboxes = row.querySelectorAll("td:nth-child(4) .days input[type='checkbox']");
        const days = [...dayCheckboxes].filter(cb => cb.checked).map(cb => parseInt(cb.dataset.index));
        const repeat = checkboxes[checkboxes.length - 3].checked; // repeat checkbox is before focus/autodisable
        const repeatEveryInput = fourthTd.querySelector("input[type='number']");
        const repeatEvery = parseInt(repeatEveryInput?.value) || 0;
        const repeatUnitSelect = fourthTd.querySelector("select");
        const repeatUnit = repeatUnitSelect?.value || "minutes";
        const autoclose = parseInt(row.querySelector("td:nth-child(5) input").value) || 0;
        const cycleInterval = parseInt(row.querySelector("td:nth-child(6) input").value) || 0;  // Get cycle interval value
        updatedSchedules.push({
            enabled, name, url, time, days,
            autoclose, focus, autodisable, cycleInterval,
            repeat, repeatEvery, repeatUnit
        });
    });
    
    chrome.storage.local.set({ 
        schedules: updatedSchedules,
        
    }, () => {
        showSavedMessage();
    });
};