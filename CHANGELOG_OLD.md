# Older changes
## 1.2.0 (2026-07-20)
- (copilot) Adapter requires node.js >= 22 now
- Added IEEE 1547 CRC state attributes
- Fixed adapter checker warnings (jsonConfig, pollingTimeout)
- Replaced plain setTimeout with adapter-managed timers
- Added calculated charging power state (vitals.power_w)
- Added specific ioBroker roles for all states
- Simplified state attribute definitions
- Fixed startup recovery: adapter now retries if wallbox is unreachable at start
- Capped retry delay at 1 hour
- Fixed state attribute typos and placeholder names
- Updated documentation

## 1.1.0 (2026-03-30)
- (iobroker-bot) Adapter requires node.js >= 20 now.
- Added state attributes (and moved notifications to debug from info)
- Code optimization
- Migration to i18n

## 1.0.6 (NoBl)
* Maintenance update (dependencies, ...)
