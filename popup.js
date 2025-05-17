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
  
  // Get the stored interval value
  chrome.storage.local.get("intervalSeconds", (data) => {
    intervalInput.value = data.intervalSeconds || defaultCycleInterval;
  });

  // Listen for changes and send to background
  intervalInput.addEventListener("input", () => {
    let newInterval = parseInt(intervalInput.value, 10);
    if (!isNaN(newInterval) && newInterval > 0) {
      chrome.runtime.sendMessage({ action: "setInterval", value: newInterval });
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
        noTabsCell.textContent = "No tabs scheduled.";
        noTabsCell.style.textAlign = "center";
        noTabsCell.style.padding = "10px";
        noTabsRow.appendChild(noTabsCell);
        tbody.appendChild(noTabsRow);
        return;  // Exit early
    }

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
      <ul style="margin: 0; padding-left: 1.2em;">
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
  });

  chrome.storage.local.get("tabIntervals", (res) => {
    const tabIntervals = res.tabIntervals || {};
    updatePlaylist(tabIntervals);
  });
});

// Update the playlist section
function updatePlaylist(tabIntervals) {
  playlistSection.innerHTML = "<div id='playlist-loading'></div>"; // Show loading spinner

  chrome.tabs.query({}, (tabs) => {
    chrome.storage.local.get("tabIntervals", (res) => {
      playlistSection.innerHTML = "<h3>Tabs Currently Open</h3>"; // Remove spinner, reset section

      const playlistUl = document.createElement("ul");
      const maxTabsToShow = 3;
      let isExpanded = false;

      tabs.forEach((tab, index) => {
        const playlistItem = document.createElement("li");
        playlistItem.classList.add("playlist-item");

        const favicon = document.createElement("img");
        favicon.src = tab.favIconUrl || "default-favicon.png";
        favicon.className = "tab-favicon";

        const textContainer = document.createElement("div");
        textContainer.className = "playlist-text";

        const titleSpan = document.createElement("span");
        titleSpan.className = "tab-title";
        titleSpan.textContent = tab.title;

        const intervalSpan = document.createElement("span");
        intervalSpan.className = "tab-interval";
        chrome.storage.local.get("intervalSeconds", (data) => {
          intervalSpan.textContent = `Cycle interval: ${tabIntervals[tab.id] || data.intervalSeconds} sec`;
        });

        textContainer.appendChild(titleSpan);
        textContainer.appendChild(intervalSpan);

        playlistItem.appendChild(favicon);
        playlistItem.appendChild(textContainer);


        if (index >= maxTabsToShow) {
          playlistItem.style.display = "none";
          playlistItem.classList.add("hidden-tab");
        }

        playlistUl.appendChild(playlistItem);
      });

      playlistSection.appendChild(playlistUl);

      if (tabs.length > maxTabsToShow) {
        const moreDiv = document.createElement("div");
        moreDiv.textContent = `+${tabs.length - maxTabsToShow} more`;
        moreDiv.className = "more-tabs";
        playlistSection.appendChild(moreDiv);

        moreDiv.addEventListener("click", () => {
          isExpanded = !isExpanded;
          document.querySelectorAll(".hidden-tab").forEach(item => {
            item.style.display = isExpanded ? "flex" : "none";
          });
          moreDiv.textContent = isExpanded ? "Show Less" : `+${tabs.length - maxTabsToShow} more`;
        });
      }
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