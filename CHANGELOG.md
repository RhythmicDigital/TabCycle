# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.4.4] - 2025-06-08
### Fixed
- Update extension name and description.

## [2.4.3] - 2025-06-08
### Fixed
- Fixed no tabs message not appearing/disappearing when adding/deleting scheduled tabs in options.

## [2.4.2] - 2025-06-08
### Fixed
- Fixed default cycle interval reverting to initial default interval of 15.

## [2.4.1] - 2025-06-08
### Fixed
- Fixed scheduled tabs view in popup not showing when there are no scheduled tabs.
- Scheduled tabs table now displays "No tabs displayed" in options page when there are no scheduled tabs.
- Scheduled tabs table in popup now displays "No tabs scheduled. Click 'Configure Tabs' to add scheduled tabs".

## [2.4.0] - 2025-06-03
### Added
- Added slider to update default cycle interval.
- Added toggle to collapse/expand popup by showing/hiding open tabs list.
- Moved scheduled tabs list to its own view in popup.
- Added an Additional Settings view to popup.
- Added a dark mode toggle in Additional Settings.
- Added a Help button that links to the FAQ section on tabcycle.com.
- Added header box with gradient in popup.
- Added buttons in header including: scheduled tabs button, additional settings button, options button, and home button that directs to tabcycle.com.
- Styled popup with contained boxes for better layout clarity.
- Added animated gradient background for popup.
- Updated color of header row colors.
- Updated schedule table header in popup from "Date & Time to Open" to "Date & Time to Open Next".
- Added URL validation to URL input for scheduled tab configs in options, with updated styling for URL input.

### Fixed
- Fixed adding/deleting scheduled tab configs affecting view in options, and now automatically adjusts scrolling of page when adding/deleting.
- Fixed default interval not being applied to tabs without manual override.
- Reset tab intervals button now correctly resets all tab intervals, even those manually set.
- Collapse button no longer reappears incorrectly when switching between views.
- Interval changes no longer affect manually configured tab intervals unless explicitly updated.

## [2.3.8] - 2025-05-25
### Added
- Added locale messages for Edge

## [2.3.7] - 2025-05-16
### Added
- Added open button in options page to open scheduled tabs immediately.
- Updated options page icon.

### Fixed
- Fixed defect where repeating scheduled tabs would open on every change to scheduled tabs. 
- Scheduled tabs will now repeatedly open only if it has first opened at its initially scheduled time.
- Truncated long URLs in tab cycle configuration table in options page and make them expandable.
- Adjusted layout of scheduled tabs table in popup.
- Improved "open next" info text for scheduled tabs in popup.

## [2.3.6] - 2025-05-08
### Added
- Added CHANGELOG and README files.

## [2.3.5] - 2025-05-08
### Fixed
- Refactored layout in popup to improve responsiveness and structure.

## [2.3.4] - 2025-05-08
### Fixed
- Resolved issues with scheduled tab repeat functionality.

## [2.3.3] - 2025-05-08
### Fixed
- Updated options page and added icons.

## [2.3.2] - 2025-05-05
### Added
- Updated scheduled tabs list to be scrollable in popup

## [2.3.1] - 2025-05-05
### Added
- Popup now displays "No tabs scheduled" when there are no scheduled tabs.

## [2.3.0] - 2025-05-05
### Added
- Added configuration for cycling tabs in a specific window.

## [2.2.0] - 2025-04-28
### Added
- Added repeating scheduled tab opening in seconds.

## [2.1.1] - 2025-04-28
### Added
- Popup now displays tabs currently open along with each tab's cycle interval.
- Scheduled tabs now have configurable cycle intervals.

## [2.1.0] - 2025-04-26
### Added
- Added badge to show cycle interval countdown.
- Added play/pause icons that change when cycling starts/stops.

## [2.0.0] - 2025-04-21
### Added
- Introduced tab scheduling with support for autoclose and autodisable.
- Added a responsive options page for managing scheduled tabs.
- Integrated tab cycling functionality with the new tab scheduling feature.
- Replaced separate Play/Stop buttons with a single toggle.

## [1.1.1] - 2025-04-16
### Fixed
- Tab cycling now restarts when entering new cycle interval.

## [1.1.0] - 2025-04-16
### Added
- Added onboarding page and updated popup UI.
- Cycle interval now loads from local storage and is updated when inputting a new interval.

## [1.1.0] - 2025-04-16
### Added
- Added onboarding page and updated popup UI.
- Cycle interval now loads from local storage and is updated on input change

## [1.1.0] - 2025-05-08
### Added
- Added onboarding page and updated popup UI.
- Cycle interval now loads from local storage and is updated on input change

### Fixed
- Resolved an issue where tabs would occasionally cycle out of order.

## [1.0.0] - 2025-03-18
### Added
- Initial release of TabCycle.
- Cycle tabs at a user-defined interval.