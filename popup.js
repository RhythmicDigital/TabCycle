document.getElementById("start").addEventListener("click", () => {
    const interval = parseInt(document.getElementById("interval").value, 10) || 5;
    chrome.runtime.sendMessage({ command: "start", interval });
});

document.getElementById("stop").addEventListener("click", () => {
    chrome.runtime.sendMessage({ command: "stop" });
});

