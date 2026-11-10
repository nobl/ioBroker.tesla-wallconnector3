# Older changes
## 1.3.0 (2026-08-04)
- Added North American split-phase power calculation mode (splitPhase setting)
- Added recovery for malformed wallbox responses (bare nan, Infinity, and truncated data)
- Added address validation: clearer error messages for misconfigured wallbox addresses
- Added 2 MiB response size limit
- Fixed connection status flapping when the wallbox was partially reachable
- Fixed charging power (power_w) sometimes showing a stale value after charging stops — now always 0 when not charging
- Fixed handling of additional malformed sensor readings from certain firmware versions
- Fixed unavailable sensor readings showing as empty instead of 0
- Fixed state types sometimes changing unexpectedly, including after adapter restart
- Fixed alerts and not-ready reasons not updating correctly when the list changes
- Fixed all data refreshing immediately after connection loss recovery
- Fixed retry count being off by one compared to the configured value
- Fixed rare state updates still happening briefly after adapter shutdown
- Fixed timeout help text showing wrong maximum (now correctly shows 10000 ms)
- Fixed wallbox requests failing on systems with an HTTP proxy configured
- Corrected WiFi signal strength metadata
- Fixed database errors no longer triggering unnecessary reconnection attempts
- Reduced load on wallbox: version data polled hourly, WiFi and lifetime data every 60 seconds
- Expanded and corrected documentation

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
