const scheduleList = document.getElementById("schedule-list");
const previewButton = document.getElementById("preview");
const optionsButton = document.getElementById("options");
const startStopbutton = document.getElementById("toggle-cycle");
const intervalInput = document.getElementById("interval");
const icon = document.getElementById("toggle-icon");
const text = document.getElementById("toggle-text");

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
    intervalInput.value = data.intervalSeconds || 15; // Default to 5 if undefined
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
      nextOpenText.innerHTML = `${openText}. Display for <strong>${entry.autoclose} seconds</strong>.`;
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
});

previewButton.onclick = () => {
  chrome.runtime.sendMessage({ action: "previewNow" });
};

optionsButton.onclick = () => {
  chrome.runtime.openOptionsPage();
};

function saveSchedule(index, updatedEntry) {
  chrome.storage.local.get("schedules", (res) => {
    const schedules = res.schedules || [];
    schedules[index] = updatedEntry;
    chrome.storage.local.set({ schedules });
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