# <img src="admin/tesla-wallconnector3.png" width="36" align="top" alt=""> ioBroker.tesla-wallconnector3

[![NPM version](http://img.shields.io/npm/v/iobroker.tesla-wallconnector3.svg)](https://www.npmjs.com/package/iobroker.tesla-wallconnector3)
[![Downloads](https://img.shields.io/npm/dm/iobroker.tesla-wallconnector3.svg)](https://www.npmjs.com/package/iobroker.tesla-wallconnector3)
![Number of Installations (latest)](http://iobroker.live/badges/tesla-wallconnector3-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/tesla-wallconnector3-stable.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/nobl/ioBroker.tesla-wallconnector3/badge.svg)](https://snyk.io/test/github/nobl/ioBroker.tesla-wallconnector3)

[![NPM](https://nodei.co/npm/iobroker.tesla-wallconnector3.png?downloads=true)](https://nodei.co/npm/iobroker.tesla-wallconnector3/)

**Tests:** ![Test and Release](https://github.com/nobl/ioBroker.tesla-wallconnector3/workflows/Test%20and%20Release/badge.svg)

## Tesla Wall Connector Gen 3 adapter for ioBroker

Reads live data from a [Tesla Wall Connector Gen 3](https://www.tesla.com/support/charging/wall-connector) on your local network. The adapter polls the wallbox API and creates ioBroker states for charging status, power, energy, temperatures, WiFi, and more.

All states are read-only (the wallbox API does not support write access).

[Documentation EN](docs/en/README.md) | [Dokumentation DE](docs/de/README.md)

## Setup

1. Install the adapter and add an instance.
2. Open the instance configuration:
   ![Main Settings](docs/en/media/mainSettings.png)
3. Enter the IP address or hostname of your Wall Connector (e.g. `192.168.1.50` or `wallbox.local`). Enter only the bare address — no `http://`, no port, no path.
4. Adjust the remaining settings if needed (defaults work well for most setups):
   - **Polling interval** — how often to read data (default: 10 s)
   - **Request timeout** — how long to wait for a response, in milliseconds (default: 5000, range: 1000 - 10000)
   - **Retries** — how many times to retry after a failed poll (default: 10, 0 = never, 999 = unlimited)
   - **Retry factor** — spaces retries further apart; the n-th retry waits interval x factor x n seconds (default: 2)
   - **Split-phase power** — enable for North American split-phase installations
5. Click **Save & Close**. The adapter will start polling immediately.

## States

The adapter creates states under four channels. For a full reference of every state, see the [detailed documentation](docs/en/README.md).

| Channel | What it contains |
|:--------|:-----------------|
| **info** | `info.connection` — whether the adapter can reach the wallbox |
| **vitals** | Live data: charging state, vehicle connected, current, voltage, power, temperatures, alerts |
| **lifetime** | Cumulative stats: total energy, charge starts, uptime, contactor/connector cycles |
| **wifi_status** | WiFi connection: SSID, IP, MAC, signal strength, RSSI |
| **version** | Firmware version, serial number, part number |

The adapter also creates a calculated `vitals.power_w` state showing the current charging power in watts.

*Additional states may appear depending on your wallbox firmware version.*

## Donate
Maintenance of this adapter can be quite time consuming. If you wish to thank the author, please use these links:
[![WERO](https://img.shields.io/badge/WERO-8A2BE2)](https://share.weropay.eu/p/1/c/QzzqgSQcI3)
[![PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.me/gerbots)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/norblu)
[![GitHub Sponsor](https://img.shields.io/badge/Sponsor-GitHub-181717?logo=github&logoColor=white)](https://github.com/sponsors/nobl)
   
## Changelog
<!--
  Placeholder for the next version (at the beginning of the line):
  ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- Added North American split-phase power calculation mode (splitPhase setting)
- Added Tesla firmware JSON defect recovery (bare nan, Infinity, -Infinity, missing closing brace)
- Added host validation: rejects URLs, paths, credentials, and ports; empty or 0.0.0.0 treated as unconfigured
- Added 2 MiB response size limit
- Fixed state type stability: null values no longer cause type oscillation, including after adapter restart
- Fixed stale array state cleanup: current_alerts and evse_not_ready_reasons publish canonical JSON and clean up obsolete child states
- Fixed complete data refresh after connection loss: all endpoints polled immediately on reconnect
- Fixed retry off-by-one: configured retries value now means actual retry attempts after initial failure
- Fixed unload race condition: prevented post-unload state changes when poll requests are in flight
- Fixed numeric string coercion: Infinity and NaN values no longer silently converted to numbers
- Fixed timeout configuration help text to show correct maximum (10000 ms)
- Corrected wifi signal strength/RSSI metadata
- Separated persistence errors from communication errors: database write failures no longer trigger connection retry
- Reduced API load: version polled hourly, lifetime and wifi_status every 60s, sequential requests
- Enabled TypeScript type checking in CI
- Expanded and corrected documentation

### 1.2.0 (2026-07-20)
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

### 1.1.0 (2026-03-30)
- (iobroker-bot) Adapter requires node.js >= 20 now.
- Added state attributes (and moved notifications to debug from info)
- Code optimization
- Migration to i18n

### 1.0.6 (NoBl)
* Maintenance update (dependencies, ...)

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2024-2026 Norbert Bluemle <github@bluemle.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
