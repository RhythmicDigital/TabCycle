// Update information - update this when releasing new versions
const updates = {
    '2.5.0': {
        added: [
            'Reload tab on cycle.',
            'Auto-start cycling on browser startup.',
            'Skip pinned tabs when cycling.',
            'Auto-start tab cycling in schedule entry options.',

        ],
        fixed: [],
        changed: []
    },
    '2.4.4': {
        added: [],
        fixed: [
            'Update extension name and description.'
        ],
        changed: []
    },
    '2.4.3': {
        added: [],
        fixed: [
            'Fixed no tabs message not appearing/disappearing when adding/deleting scheduled tabs in options.'
        ],
        changed: []
    },
    '2.4.2': {
        added: [],
        fixed: [
            'Fixed default cycle interval reverting to initial default interval of 15.'
        ],
        changed: []
    },
    '2.4.1': {
        added: [],
        fixed: [
            'Fixed scheduled tabs view in popup not showing when there are no scheduled tabs.',
            'Scheduled tabs table now displays "No tabs displayed" in options page when there are no scheduled tabs.',
            'Scheduled tabs table in popup now displays "No tabs scheduled. Click \'Configure Tabs\' to add scheduled tabs".'
        ],
        changed: []
    },
    '2.4.0': {
        added: [
            'Added slider to update default cycle interval.',
            'Added toggle to collapse/expand popup by showing/hiding open tabs list.',
            'Moved scheduled tabs list to its own view in popup.',
            'Added an Additional Settings view to popup.',
            'Added a dark mode toggle in Additional Settings.',
            'Added a Help button that links to the FAQ section on tabcycle.com.',
            'Added header box with gradient in popup.',
            'Added buttons in header including: scheduled tabs button, additional settings button, options button, and home button that directs to tabcycle.com.',
            'Styled popup with contained boxes for better layout clarity.',
            'Added animated gradient background for popup.',
            'Added URL validation to URL input for scheduled tab configs in options, with updated styling for URL input.'
        ],
        fixed: [
            'Fixed adding/deleting scheduled tab configs affecting view in options, and now automatically adjusts scrolling of page when adding/deleting.',
            'Fixed default interval not being applied to tabs without manual override.',
            'Reset tab intervals button now correctly resets all tab intervals, even those manually set.',
            'Collapse button no longer reappears incorrectly when switching between views.',
            'Interval changes no longer affect manually configured tab intervals unless explicitly updated.'
        ],
        changed: [
            'Updated color of header row colors.',
            'Updated schedule table header in popup from "Date & Time to Open" to "Date & Time to Open Next".'
        ]
    }
};

function initUpdatePage() {
    try {
        // Get version from manifest
        let manifest = null;
        let currentVersion = '2.4.5';
        
        try {
            manifest = chrome.runtime.getManifest();
            if (manifest && manifest.version) {
                currentVersion = manifest.version;
            }
        } catch (e) {
            console.log('Could not get manifest, using default version');
        }

        const versionBadge = document.getElementById('version-badge');
        if (versionBadge) {
            versionBadge.textContent = 'v' + currentVersion;
        }

        // Get updates for current version
        const versionUpdates = updates[currentVersion];

        if (versionUpdates) {
            const addedList = document.getElementById('added-list');
            const fixedList = document.getElementById('fixed-list');
            const changedList = document.getElementById('changed-list');

            // Display added features
            if (versionUpdates.added && versionUpdates.added.length > 0 && addedList) {
                versionUpdates.added.forEach(function(item) {
                    const li = document.createElement('li');
                    li.textContent = item;
                    addedList.appendChild(li);
                });
            } else if (addedList && addedList.parentElement) {
                addedList.parentElement.style.display = 'none';
            }

            // Display fixed bugs
            if (versionUpdates.fixed && versionUpdates.fixed.length > 0 && fixedList) {
                versionUpdates.fixed.forEach(function(item) {
                    const li = document.createElement('li');
                    li.textContent = item;
                    fixedList.appendChild(li);
                });
            } else if (fixedList && fixedList.parentElement) {
                fixedList.parentElement.style.display = 'none';
            }

            // Display improvements
            if (versionUpdates.changed && versionUpdates.changed.length > 0 && changedList) {
                versionUpdates.changed.forEach(function(item) {
                    const li = document.createElement('li');
                    li.textContent = item;
                    changedList.appendChild(li);
                });
            } else if (changedList && changedList.parentElement) {
                changedList.parentElement.style.display = 'none';
            }
        } else {
            // If no updates found for this version, show a generic message
            const updateSection = document.getElementById('update-section');
            if (updateSection) {
                updateSection.innerHTML = '<p>TabCycle has been updated! Thank you for using TabCycle.</p>';
            }
        }

        // Button handlers
        const optionsButton = document.getElementById('options-button');
        const closeButton = document.getElementById('close-button');

        if (optionsButton) {
            optionsButton.addEventListener('click', function() {
                try {
                    if (chrome.runtime && chrome.runtime.openOptionsPage) {
                        chrome.runtime.openOptionsPage();
                    }
                } catch (e) {
                    console.error('Error opening options page:', e);
                }
                try {
                    window.close();
                } catch (e) {
                    console.error('Error closing window:', e);
                }
            });
        }

        if (closeButton) {
            closeButton.addEventListener('click', function() {
                try {
                    window.close();
                } catch (e) {
                    console.error('Error closing window:', e);
                }
            });
        }
    } catch (error) {
        console.error('Error loading update page:', error);
        // Fallback: show a simple message
        const updateSection = document.getElementById('update-section');
        if (updateSection) {
            updateSection.innerHTML = '<p>TabCycle has been updated! Thank you for using TabCycle.</p>';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpdatePage);
} else {
    // DOM is already ready
    initUpdatePage();
}