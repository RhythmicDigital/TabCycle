document.getElementById("start").addEventListener("click", () => {
    const interval = parseInt(document.getElementById("interval").value, 10) || 5;
    chrome.runtime.sendMessage({ command: "start", interval });
});

document.getElementById("stop").addEventListener("click", () => {
    chrome.runtime.sendMessage({ command: "stop" });
});

document.addEventListener("DOMContentLoaded", () => {
    let intervalInput = document.getElementById("interval");
  
    // Get the stored interval value
    chrome.storage.local.get("intervalSeconds", (data) => {
      intervalInput.value = data.intervalSeconds || 5; // Default to 5 if undefined
    });
    
    // Listen for changes and send to background
    intervalInput.addEventListener("change", () => {
      let newInterval = parseInt(intervalInput.value, 10);
      if (!isNaN(newInterval) && newInterval > 0) {
        chrome.runtime.sendMessage({ action: "setInterval", value: newInterval });
        }
    });
  });