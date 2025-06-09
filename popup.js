const scheduleList = document.getElementById("schedule-list");
const previewButton = document.getElementById("preview");
const optionsButton = document.getElementById("options");
const startStopbutton = document.getElementById("toggle-cycle");
const intervalInput = document.getElementById("interval");
const icon = document.getElementById("toggle-icon");
const text = document.getElementById("toggle-text");
const playlistSection = document.getElementById("playlist-section");
const defaultCycleInterval = 15;
const windowSelect = document.getElementById("window-select");
const slider = document.getElementById("interval-slider");

let isCycling = false;

function updateToggleButton() {
  if (isCycling) {
    startStopbutton.classList.remove("stopped");
    startStopbutton.classList.add("started");
    icon.textContent = "⏸️"; // Pause icon
    text.textContent = "Stop";
  } else {
    startStopbutton.classList.remove("started");
    startStopbutton.classList.add("stopped");
    icon.textContent = "▶️"; // Play icon
    text.textContent = "Start";
  }
}

// Update display and store new value when user changes it
slider.addEventListener("input", () => {
  const val = parseInt(slider.value, 10);
  intervalInput.value = val;

  chrome.storage.local.set({ intervalSeconds: val });
  chrome.runtime.sendMessage({ action: "setInterval", value: val });

  chrome.windows.getAll({ populate: true }, (windows) => {
    chrome.storage.local.get("tabIntervals", (res) => {
      const updated = {};
      const existing = res.tabIntervals || {};
  
      windows.flatMap(win => win.tabs).forEach(tab => {
        const current = existing[tab.id];
        if (!current || !current.manual) {
          updated[tab.id] = { value: val, manual: false };
        } else {
          updated[tab.id] = current; // Preserve manually set values
        }
      });
  
      chrome.storage.local.set({ tabIntervals: updated }, () => {
        updatePlaylist(updated);
      });
    });
  });
});

document.getElementById("toggle-cycle").addEventListener("click", () => {
  if (!isCycling) {
    // Start tab cycling
    const interval = parseInt(document.getElementById("interval").value, 10) || 5;
    chrome.runtime.sendMessage({ command: "start", interval });
  } else {
    // Stop tab cycling
    chrome.runtime.sendMessage({ command: "stop" });
  }
  isCycling = !isCycling;
  chrome.storage.local.set({ isCycling });
  updateToggleButton();
});

document.addEventListener("DOMContentLoaded", () => {
  const versionSpan = document.getElementById("version");
  const manifest = chrome.runtime.getManifest();
  versionSpan.textContent = `v${manifest.version}`;
  
  chrome.storage.local.get("isCollapsed", (data) => {
    const isCollapsed = data.isCollapsed;

    // Default to collapsed if undefined
    if (typeof isCollapsed === "undefined") {
      isCollapsed = true;
      chrome.storage.local.set({ isCollapsed: true });
    }
    
    const playlist = document.getElementById("playlist-wrapper");
    const toggleButton = document.getElementById("collapse-toggle");
    
    playlist.classList.toggle("hidden-section", isCollapsed);
    toggleButton.classList.toggle("collapsed", isCollapsed);
  
    toggleButton.innerHTML = `
    <span id="collapse-icon">${isCollapsed ? "▼" : "▲"}</span>
    <span id="collapse-text">${isCollapsed ? " Expand Details" : " Collapse Details"}</span>
  `;

    resizePopupToFitContent();
  });
  
  // Get the stored interval value
  chrome.storage.local.get("intervalSeconds", (data) => {
    console.log("Loaded intervalSeconds:", data.intervalSeconds);
    const saved = data.intervalSeconds ?? defaultCycleInterval;
    slider.value = saved;
    intervalInput.value = saved;
  });

  // Listen for changes and send to background
  intervalInput.addEventListener("input", () => {
    let newInterval = parseInt(intervalInput.value, 10);
    if (!isNaN(newInterval) && newInterval > 0) {
      slider.value = newInterval;
      chrome.storage.local.set({ intervalSeconds: newInterval });
      chrome.runtime.sendMessage({ action: "setInterval", value: newInterval });
  
      chrome.windows.getAll({ populate: true }, (windows) => {
        chrome.storage.local.get("tabIntervals", (res) => {
          const existing = res.tabIntervals || {};
          const updated = {};
  
          windows.flatMap(win => win.tabs).forEach(tab => {
            const current = existing[tab.id];
            if (!current || !current.manual) {
              updated[tab.id] = { value: newInterval, manual: false };
            } else {
              updated[tab.id] = current; // Preserve manually set ones
            }
          });
  
          chrome.storage.local.set({ tabIntervals: updated }, () => {
            updatePlaylist(updated);
          });
        });
      });
    }
  });

  // Stop tab cycling when opening popup
  chrome.runtime.sendMessage({ command: "stop" });
  isCycling = false;
  chrome.storage.local.set({ isCycling });
  updateToggleButton();

  chrome.storage.local.get("isCycling", (data) => {
    isCycling = data.isCycling || false;
    updateToggleButton();
  });

  const tableBody = document.createElement("table");
  tableBody.className = "popup-table";

  const tbody = document.getElementById("popup-table-body");
  
  chrome.storage.local.get("schedules", (res) => {
    const schedules = res.schedules || [];

    // If no schedules, show a message
    if (schedules.length === 0) {
        const noTabsRow = document.createElement("tr");
        const noTabsCell = document.createElement("td");
        noTabsCell.colSpan = 4; // Span across all table columns
        noTabsCell.className = "no-schedule-cell";
        noTabsCell.textContent = "No tabs scheduled. Click 'Configure Tabs' to add scheduled tabs.";
        noTabsCell.style.textAlign = "center";
        noTabsCell.style.padding = "10px";
        noTabsRow.appendChild(noTabsCell);
        tbody.appendChild(noTabsRow);
      } else {

      // Otherwise, render the table rows as normal
      schedules.forEach((entry, index) => {
        const row = document.createElement("tr");

        // Active toggle
        const activeCell = document.createElement("td");
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = entry.enabled;
        toggle.addEventListener("change", () => {
          entry.enabled = toggle.checked;
          saveSchedule(index, entry);
        });
        activeCell.appendChild(toggle);
        row.appendChild(activeCell);

        // Name input
        const nameCell = document.createElement("td");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = entry.name || "";
        nameInput.addEventListener("change", () => {
          entry.name = nameInput.value;
          saveSchedule(index, entry);
        });
        nameCell.appendChild(nameInput);
        row.appendChild(nameCell);

        // Next Open Time
        const nextOpenCell = document.createElement("td");
        const nextOpenText = document.createElement("span");
        let openText = getNextOpenDate(entry) != "Not scheduled" ? `Open on ${getNextOpenDate(entry)}` : `${getNextOpenDate(entry)}`;
        let repeatText = "";

        if (entry.repeat && entry.repeatEvery > 0) {
          const pluralizeUnit = (count, unit) => count === 1 ? unit.slice(0, -1) : unit;
          repeatText = `Will reopen every <strong>${entry.repeatEvery} ${pluralizeUnit(entry.repeatEvery, entry.repeatUnit)}</strong> after its initial launch.`;      
        } else {
          repeatText = ` Will open only once at scheduled time.`;
        }

        let displayText = entry.autoclose <= 0
          ? `Auto-close off – will display until cycled.`
          : `Display for <strong>${entry.autoclose} second(s)</strong>.`;

          nextOpenText.innerHTML = `
          <ul class="schedule-details">
            <li>${openText}</li>
            <li>${displayText}</li>
            <li>${repeatText}</li>
          </ul>
        `;
        nextOpenCell.appendChild(nextOpenText);
        row.appendChild(nextOpenCell);

        // Open Now
        const openCell = document.createElement("td");
        const openBtn = document.createElement("button");
        openBtn.textContent = "Open";
        openBtn.title = "Open Tab Now";
        openBtn.addEventListener("click", () => {
          chrome.tabs.create({ url: entry.url, active: entry.focus || false });
        });
        openCell.appendChild(openBtn);
        row.appendChild(openCell);

        tbody.appendChild(row);
      });
    }

    document.getElementById("calendar-view-btn").addEventListener("click", () => {
      const mainView = document.getElementById("main-view");
      const calendarView = document.getElementById("calendar-view");
      const settingsView = document.getElementById("settings-view");

      const isCalendarVisible = calendarView.classList.contains("active");
      const isSettingsVisible = settingsView.classList.contains("active");

        // If settings view is open, close it
      if (isSettingsVisible) {
        settingsView.classList.remove("active");
        mainView.classList.remove("slide-left");
      }
      
      if (isCalendarVisible) {
        // Go back to main view
        calendarView.classList.remove("active");
        calendarView.classList.add("hidden-section");
    
        mainView.classList.remove("hidden-section");
        mainView.classList.add("active");
      } else {
        // Show calendar view
        mainView.classList.remove("active");
        mainView.classList.add("hidden-section");
    
        calendarView.classList.remove("hidden-section");
        calendarView.classList.add("active");
    
        renderCalendar();
      }
      updateCollapseToggleVisibility();
    });
    
    document.getElementById("back-to-main").addEventListener("click", () => {
      document.getElementById("calendar-view").classList.remove("active");
      document.getElementById("calendar-view").classList.add("hidden-section");
    
      document.getElementById("main-view").classList.remove("hidden-section");
      document.getElementById("main-view").classList.add("active");

      updateCollapseToggleVisibility();
    });
  });

  chrome.storage.local.get("tabIntervals", (res) => {
    const tabIntervals = res.tabIntervals || {};
    updatePlaylist(tabIntervals);
  });

  document.getElementById("open-settings").addEventListener("click", () => {
    const mainView = document.getElementById("main-view");
    const calendarView = document.getElementById("calendar-view");
    const settingsView = document.getElementById("settings-view");
  
    const isCalendarVisible = calendarView.classList.contains("active");
    const isSettingsVisible = settingsView.classList.contains("active");
  
    // CASE 1: Already in settings view — go back to main
    if (isSettingsVisible && !isCalendarVisible) {
      settingsView.classList.remove("active");
      settingsView.classList.add("hidden-section");
  
      mainView.classList.remove("hidden-section");
      mainView.classList.add("active");
  
      updateCollapseToggleVisibility();
      return; // Important to prevent further logic from running
    }
  
    // CASE 2: Calendar view is visible — close it and go to settings
    if (isCalendarVisible) {
      calendarView.classList.remove("active");
      calendarView.classList.add("hidden-section");
  
      settingsView.classList.remove("hidden-section");
      settingsView.classList.add("active");
  
      mainView.classList.add("hidden-section");
      mainView.classList.remove("active");
    } else {
      // CASE 3: Going to settings view from main
      mainView.classList.remove("active");
      mainView.classList.add("hidden-section");
  
      settingsView.classList.remove("hidden-section");
      settingsView.classList.add("active");
    }
  
    updateCollapseToggleVisibility();
  });
  
  document.getElementById("back-button").addEventListener("click", () => {
    const mainView = document.getElementById("main-view");
    const settingsView = document.getElementById("settings-view");
  
    // Hide settings
    settingsView.classList.remove("active");
    settingsView.classList.add("hidden-section");
  
    // Show main
    mainView.classList.remove("hidden-section");
    mainView.classList.remove("slide-left"); // If using slide effect
    mainView.classList.add("active");
  
    resizePopupToFitContent();
    updateCollapseToggleVisibility();
  });
  
  document.getElementById("collapse-toggle").addEventListener("click", () => {
    const mainView = document.getElementById("main-view");
  
    // Only allow collapsing if we're in the main view
    if (mainView.classList.contains("active") && !mainView.classList.contains("hidden-section")) {
      const playlist = document.getElementById("playlist-wrapper");
      const toggleButton = document.getElementById("collapse-toggle");
  
      const isCollapsed = toggleButton.classList.toggle("collapsed");
  
      playlist.classList.toggle("hidden-section", isCollapsed);
  
      toggleButton.innerHTML = `
        <span id="collapse-icon">${isCollapsed ? "▼" : "▲"}</span>
        <span id="collapse-text">${isCollapsed ? " Expand Details" : " Collapse Details"}</span>
      `;
  
      chrome.storage.local.set({ isCollapsed });
      resizePopupToFitContent();
    }
  });
});

function renderCalendar() {
  const container = document.getElementById("calendar-container");
  container.innerHTML = "";

  chrome.storage.local.get("schedules", (res) => {
    const schedules = res.schedules || [];
    const dateMap = {};

    schedules.forEach(entry => {
      const nextDateText = getNextOpenDate(entry);
      const tmpDiv = document.createElement("div");
      tmpDiv.innerHTML = nextDateText;
      const plainText = tmpDiv.textContent || tmpDiv.innerText;

      if (!plainText.includes("Not scheduled")) {
        if (!dateMap[plainText]) dateMap[plainText] = [];
        dateMap[plainText].push(entry.name || entry.url);
      }
    });

    for (const date in dateMap) {
      const block = document.createElement("div");
      block.className = "calendar-block";

      const dateHeading = document.createElement("h4");
      dateHeading.textContent = date;
      block.appendChild(dateHeading);

      const ul = document.createElement("ul");
      dateMap[date].forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        ul.appendChild(li);
      });

      block.appendChild(ul);
      container.appendChild(block);
    }
  });
}

// Additional Settings Page
document.getElementById("dark-theme-toggle").addEventListener("change", (e) => {
  if (e.target.checked) {
    document.body.classList.add("dark");
    chrome.storage.local.set({ theme: "dark" });
  } else {
    document.body.classList.remove("dark");
    chrome.storage.local.set({ theme: "light" });
  }
});

// Load theme on popup open
chrome.storage.local.get("theme", (res) => {
  if (res.theme === "dark") {
    document.body.classList.add("dark");
    document.getElementById("dark-theme-toggle").checked = true;
  }
});

document.getElementById("help-button").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://tabcycle.com/#faq" });
});

document.getElementById("home-button").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://tabcycle.com" });
});

document.getElementById("settings-button").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function resizePopupToFitContent() {
  requestAnimationFrame(() => {
    document.body.style.height = "auto";
    document.documentElement.style.height = "auto";
  });
}

function updateCollapseToggleVisibility() {
  const mainView = document.getElementById("main-view");
  const calendarView = document.getElementById("calendar-view");
  const settingsView = document.getElementById("settings-view");
  const collapseToggle = document.getElementById("collapse-toggle");

  const isMainView = mainView.classList.contains("active");
  const isScheduledView = calendarView.classList.contains("active");
  const isSettingsView = settingsView.classList.contains("active");

  // Only show the collapse button in the main view
  if (isMainView && !isScheduledView && !isSettingsView) {
    collapseToggle.style.display = "inline-flex";
  } else {
    collapseToggle.style.display = "none";
  }
}

// Update the playlist section
function updatePlaylist(tabIntervals) {
  playlistSection.innerHTML = "<div id='playlist-loading'></div>";

  chrome.windows.getAll({ populate: true }, (windows) => {
    chrome.storage.local.get("intervalSeconds", (res) => {
      const defaultInterval = res.intervalSeconds ?? defaultCycleInterval;
      playlistSection.innerHTML = `
      <div class="playlist-header">
        <h3>Tabs Currently Open</h3>
        <button id="reset-tab-intervals" class="popup-button medium">Reset All</button>
      </div>
    `;

      const container = document.createElement("div");
      container.className = "playlist-vertical";
      
      windows.forEach((win, winIndex) => {
        const windowGroup = document.createElement("div");
        windowGroup.className = "window-group";

        const windowTitle = document.createElement("h4");
        windowTitle.textContent = `Window ${winIndex + 1}`;
        windowGroup.appendChild(windowTitle);

        const tabList = document.createElement("div");
        tabList.className = "playlist-horizontal";

        win.tabs.forEach(tab => {
          const item = document.createElement("div");
          item.className = "playlist-item";

          const favicon = document.createElement("img");
          favicon.src = tab.favIconUrl || "default-favicon.png";
          favicon.className = "tab-favicon";

          const textContainer = document.createElement("div");
          textContainer.className = "playlist-text";

          const titleSpan = document.createElement("span");
          titleSpan.className = "tab-title";
          titleSpan.textContent = tab.title;

          textContainer.appendChild(titleSpan);

          // Create editable input for cycle interval
          const intervalWrapper = document.createElement("div");
          intervalWrapper.className = "tab-interval";
          
          const intervalLabel = document.createElement("label");
          intervalLabel.textContent = "Interval (sec): ";
          
          const intervalInput = document.createElement("input");
          intervalInput.type = "number";
          intervalInput.min = 1;
          intervalInput.max = 999;
          const intervalData = tabIntervals[tab.id];
          intervalInput.value = intervalData?.value || defaultInterval;          intervalInput.dataset.tabId = tab.id;
          intervalInput.className = "tab-interval-input";

          intervalInput.addEventListener("change", () => {
            const newVal = parseInt(intervalInput.value, 10);
            if (!isNaN(newVal)) {
              chrome.storage.local.get("tabIntervals", (res) => {
                const updated = res.tabIntervals || {};
                updated[tab.id] = { value: newVal, manual: true };
                chrome.storage.local.set({ tabIntervals: updated });
              });
            }
          });
          
          intervalLabel.appendChild(intervalInput);
          intervalWrapper.appendChild(intervalLabel);
          textContainer.appendChild(intervalWrapper);

          item.appendChild(favicon);
          item.appendChild(textContainer);
          tabList.appendChild(item);
        });

        windowGroup.appendChild(tabList);
        container.appendChild(windowGroup);
      });

      playlistSection.appendChild(container);

      document.getElementById("reset-tab-intervals").addEventListener("click", () => {
        chrome.windows.getAll({ populate: true }, (windows) => {
          const allTabs = windows.flatMap(win => win.tabs);
      
          chrome.storage.local.get(["intervalSeconds", "tabIntervals"], (res) => {
            const defaultInterval = res.intervalSeconds ?? defaultCycleInterval;
            const existingIntervals = res.tabIntervals || {};
            const updatedIntervals = { ...existingIntervals };
      
            allTabs.forEach(tab => {
              updatedIntervals[tab.id] = { value: defaultInterval, manual: false };
            });
      
            chrome.storage.local.set({ tabIntervals: updatedIntervals }, () => {
              updatePlaylist(updatedIntervals); // Refresh visual
            });
          });
        });
      });
    });
  });
}

function getNextOpenDate(entry) {
  if (!entry.days || entry.days.length === 0) return "Not scheduled";

  const now = new Date();
  const currentDay = now.getDay();
  const [hour, minute] = entry.time?.split(":").map(Number) || [8, 0];

  for (let i = 0; i <= 7; i++) {
    const dayToCheck = (currentDay + i) % 7;
    if (entry.days.includes(dayToCheck)) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + i);
      nextDate.setHours(hour, minute, 0, 0);
      if (i === 0 && nextDate < now) continue;
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      const dateStr = `<strong>${nextDate.toLocaleDateString(undefined, options)}</strong>`;
      const timeStr = `<strong>${nextDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>`;

      return `${dateStr} at ${timeStr}`;
    }
  }

  return "No valid date";
}

previewButton.onclick = () => {
  chrome.runtime.sendMessage({ action: "previewNow" });
};

optionsButton.onclick = () => {
  chrome.runtime.openOptionsPage();
};

// Populate the window list with active tab titles
chrome.windows.getAll({ populate: true }, (windows) => {
    let i = 1;
    windows.forEach(win => {
        const activeTab = win.tabs.find(tab => tab.active);
        const option = document.createElement("option");
        option.value = win.id;
        const windowTitle = activeTab ? activeTab.title : "No active tab";
        option.textContent = `[Window ${i}] Current tab: "${windowTitle}"`;
        windowSelect.appendChild(option);
        i++;
    });

    // Set previously selected window
    chrome.storage.local.get("targetWindowId", (data) => {
        windowSelect.value = data.targetWindowId || "active";
    });
});

function saveSchedule(index, updatedEntry) {
  chrome.storage.local.get("schedules", (res) => {
    const schedules = res.schedules || [];
    if (index >= 0 && index < schedules.length) {
      schedules[index] = updatedEntry;
      chrome.storage.local.set({ schedules }, () => {
        chrome.runtime.sendMessage({ action: "refreshAlarms" });
      });
    }
  });
}

windowSelect.addEventListener("change", () => {
  chrome.storage.local.set({ targetWindowId: windowSelect.value });
});