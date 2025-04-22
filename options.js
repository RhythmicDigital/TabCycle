const scheduleList = document.getElementById("schedule-list");
const addButton = document.getElementById("add-schedule");
const saveAllButton = document.getElementById("save-all");

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    focus: false
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
    
            chrome.storage.local.set({ schedules }, () => {
                showSavedMessage();
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
            autodisable: autodisableInput.checked
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
    daysDiv.querySelectorAll("input").forEach(checkbox => {
        checkbox.addEventListener("change", updateSchedule);
    });
    toggleEnabled.querySelector("input").addEventListener("change", updateSchedule);

    // Action buttons (delete)
    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X Delete";
    deleteBtn.title = "Delete";

    deleteBtn.onclick = () => {
        chrome.storage.local.get("schedules", (res) => {
        const schedules = res.schedules || [];
        if (index !== null) {
            schedules.splice(index, 1);
            chrome.storage.local.set({ schedules }, () => location.reload());
        }
        });
    };

    actionCell.appendChild(deleteBtn);
    row.appendChild(actionCell);

    document.querySelector("#schedule-body").appendChild(row);
}

chrome.storage.local.get("schedules", (res) => {
    const schedules = res.schedules || [];
    schedules.forEach((sched, i) => createScheduleEntry(sched, i));
});

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
        chrome.storage.local.set({ schedules }, () => {
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
        const autoclose = parseInt(row.querySelector("td:nth-child(5) input").value) || 0;
        
        updatedSchedules.push({ enabled, name, url, time, days, autoclose, focus, autodisable });
    });

    chrome.storage.local.set({ schedules: updatedSchedules }, () => {
        showSavedMessage();
    });
};