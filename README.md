![Logo](admin/tesla-wallconnector3.png)

# ioBroker.tesla-wallconnector3

[![NPM version](http://img.shields.io/npm/v/iobroker.tesla-wallconnector3.svg)](https://www.npmjs.com/package/iobroker.tesla-wallconnector3)
[![Downloads](https://img.shields.io/npm/dm/iobroker.tesla-wallconnector3.svg)](https://www.npmjs.com/package/iobroker.tesla-wallconnector3)
![Number of Installations (latest)](http://iobroker.live/badges/tesla-wallconnector3-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/tesla-wallconnector3-stable.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/nobl/ioBroker.tesla-wallconnector3/badge.svg)](https://snyk.io/test/github/nobl/ioBroker.tesla-wallconnector3)

[![NPM](https://nodei.co/npm/iobroker.tesla-wallconnector3.png?downloads=true)](https://nodei.co/npm/iobroker.tesla-wallconnector3/)

**Tests:** ![Test and Release](https://github.com/nobl/ioBroker.tesla-wallconnector3/workflows/Test%20and%20Release/badge.svg)

## tesla wall connector gen 3 adapter for ioBroker

[Dokumentation DE](docs/de/README.md)<br>
[Documentation EN](docs/en/README.md)

Targeted at the Tesla Wall Connector Gen 3 available at https://shop.tesla.com/de_de/product/gen-3-wall-connector .
Only provides read access to API data (write isn't supported by the API).


## Setup
Additional to the adapter installation you have to add an instance of the adapter.

### ioBroker 
1. Open your ioBroker interface in a browser (eg: 192.168.178.42:8081) (if configuration dialogue was opened automatically after installation, skip to 4.).
2. Navigate to Tab "Instances"
3. Click on the wrench symbol of the Tesla Wall Connector Gen 3 adapter
4. Now you can see the main settings of the adapter configuration page.<br>
![Main Settings](/docs/en/media/mainSettings.png)
4.1 Type in the IP-address of your Tesla Wall Connector Gen 3 (FQDN is also possible if you have a working local DNS).<br>
4.2 You can change the polling interval, too. (Default: 10 seconds)<br>
4.3 If your network requires a higher timeout for requests sent to Tesla Wall Connector Gen 3, please change the Request-Timeout in miliseconds accordingly. (Default: 5000 miliseconds)<br>
4.4 In case there is an issue communicating with Tesla Wall Connector Gen 3 the adapter will retry several times. You can adjust how often it will try to read from Tesla Wall Connector Gen 3. (Default: 10)<br>
4.5 To space retries apart a bit more you can adjust the Polling Retry Factor. (Default: 2)<br>
Example: Using default settings the 1st retry will happen 20 seconds after the initial try, the 2nd will happen 40 seconds after the 2nd try.<br>
After each successful connect to Tesla Wall Connector Gen 3, the number of retries is reset.
5. Click on Save & Close

## Usage
All states of this adapter are read-only. The adapter polls the following API endpoints and creates states for each value returned.

For detailed state documentation see: [Documentation EN](docs/en/README.md) | [Dokumentation DE](docs/de/README.md)

### Channels

#### info
* **info.connection** (boolean) - `true` if the adapter is connected to the Tesla Wall Connector Gen 3.

#### vitals
Live operational data. Key states: `evse_state` (charging state), `vehicle_connected`, `vehicle_current_a`, `session_energy_wh`, `session_s`, `currentA_a`/`currentB_a`/`currentC_a` (per-phase current), `voltageA_v`/`voltageB_v`/`voltageC_v` (per-phase voltage), `grid_v`, `grid_hz`, and temperatures.

**EVSE State codes:**

| Code | Meaning |
|:----:|:--------|
| 0 | Booting |
| 1 | Idle |
| 2 | Connected but not ready |
| 4 | Connected and ready |
| 6 | Vehicle plugged in and handshaking |
| 8 | Charging completed/interrupted |
| 9 | Ready for charging but waiting on car |
| 10 | Charging with reduced power |
| 11 | Charging full power (3 phases, 16 amps each) |

#### lifetime
Cumulative statistics: `energy_wh`, `charge_starts`, `charging_time_s`, `uptime_s`, `contactor_cycles`, `connector_cycles`, `alert_count`.

#### version
Firmware and hardware identification: `firmware_version`, `serial_number`, `part_number`, plus IEEE 1547 CRC checksums depending on firmware version.

#### wifi_status
WiFi connection status: `wifi_connected`, `internet`, `wifi_ssid`, `wifi_infra_ip`, `wifi_mac`, `wifi_signal_strength`, `wifi_rssi`, `wifi_snr`.

*The adapter dynamically creates states for all values returned by the API. Additional states may appear depending on firmware version.*

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
- (copilot) Adapter requires node.js >= 22 now
- Added IEEE 1547 CRC state attributes
- Fixed adapter checker warnings (jsonConfig, pollingTimeout)
- Replaced plain setTimeout with adapter-managed timers
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
