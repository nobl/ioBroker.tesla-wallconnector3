// State attributes
//
// Each entry maps a state key to its metadata. Only non-default fields need to be specified.
//
// Available fields:
//   name        (string, required)  — Human-readable name for the state
//   role        (string, default guessed from type) — ioBroker role (e.g. "value.voltage", "indicator.connected")
//   unit        (string, default "") — Unit of measurement (e.g. "V", "A", "°C", "Wh")
//   booltype    (boolean, default false) — Value is a boolean (0/1 → false/true)
//   multiply    (number, default 1)  — Multiply raw value by this factor

const state_attr = {
	"version.firmware_version": { name: "Firmware version" },
	"version.git_branch": { name: "Git Branch" },
	"version.part_number": { name: "Part number" },
	"version.serial_number": { name: "Serial number" },
	"version.web_service": { name: "Web Service" },
	"version.IEEE1547CombinedComplianceCrc": { name: "IEEE 1547 Combined Compliance CRC" },
	"version.IEEE1547RideThruMomentaryCessationCrc": { name: "IEEE 1547 Ride-Thru Momentary Cessation CRC" },
	"version.IEEE1547VfTripsCrc": { name: "IEEE 1547 VF Trips CRC" },
	"lifetime.contactor_cycles": { name: "Contactor cycles" },
	"lifetime.contactor_cycles_loaded": { name: "Contactor cycles loaded" },
	"lifetime.alert_count": { name: "Alert count" },
	"lifetime.thermal_foldbacks": { name: "Thermal foldbacks" },
	"lifetime.avg_startup_temp": { name: "Average startup temperature", role: "value.temperature", unit: "°C" },
	"lifetime.charge_starts": { name: "Charge starts" },
	"lifetime.energy_wh": { name: "Energy", role: "value.energy", unit: "Wh" },
	"lifetime.connector_cycles": { name: "Connector cycles" },
	"lifetime.uptime_s": { name: "Uptime", unit: "s" },
	"lifetime.charging_time_s": { name: "Charging time", unit: "s" },
	"wifi_status.wifi_ssid": { name: "SSID" },
	"wifi_status.wifi_signal_strength": { name: "WiFi Signal Strength", unit: "dBm" },
	"wifi_status.wifi_rssi": { name: "WiFi RSSI" },
	"wifi_status.wifi_snr": { name: "WiFi Signal Noise Ratio", unit: "dB" },
	"wifi_status.wifi_connected": { name: "WiFi connected", role: "indicator.connected", booltype: true },
	"wifi_status.wifi_infra_ip": { name: "WiFi IP" },
	"wifi_status.internet": { name: "WiFi Internet", role: "indicator.connected", booltype: true },
	"wifi_status.wifi_mac": { name: "WiFi MAC Address" },
	"vitals.contactor_closed": { name: "Contactor closed", booltype: true },
	"vitals.vehicle_connected": { name: "Vehicle connected", role: "indicator.connected", booltype: true },
	"vitals.session_s": { name: "Session time", unit: "s" },
	"vitals.grid_v": { name: "Grid voltage", role: "value.voltage", unit: "V" },
	"vitals.grid_hz": { name: "Grid frequency", unit: "Hz" },
	"vitals.vehicle_current_a": { name: "Vehicle Current", role: "value.current", unit: "A" },
	"vitals.currentA_a": { name: "Current Line A", role: "value.current", unit: "A" },
	"vitals.currentB_a": { name: "Current Line B", role: "value.current", unit: "A" },
	"vitals.currentC_a": { name: "Current Line C", role: "value.current", unit: "A" },
	"vitals.currentN_a": { name: "Current Line N", role: "value.current", unit: "A" },
	"vitals.evse_not_ready_reasons": { name: "EVSE not ready Reasons" },
	"vitals.voltageA_v": { name: "Voltage Line A", role: "value.voltage", unit: "V" },
	"vitals.voltageB_v": { name: "Voltage Line B", role: "value.voltage", unit: "V" },
	"vitals.voltageC_v": { name: "Voltage Line C", role: "value.voltage", unit: "V" },
	"vitals.relay_coil_v": { name: "Relais coil", role: "value.voltage", unit: "V" },
	"vitals.pcba_temp_c": { name: "Board Temperature", role: "value.temperature", unit: "°C" },
	"vitals.handle_temp_c": { name: "Handle Temperature", role: "value.temperature", unit: "°C" },
	"vitals.mcu_temp_c": { name: "MCU Temperature", role: "value.temperature", unit: "°C" },
	"vitals.uptime_s": { name: "Uptime", unit: "s" },
	"vitals.input_thermopile_uv": { name: "Input Thermopile UV" },
	"vitals.prox_v": { name: "Prox", role: "value.voltage", unit: "V" },
	"vitals.pilot_high_v": { name: "Pilot High", role: "value.voltage", unit: "V" },
	"vitals.pilot_low_v": { name: "Pilot Low", role: "value.voltage", unit: "V" },
	"vitals.session_energy_wh": { name: "Session energy", role: "value.energy", unit: "Wh" },
	"vitals.config_status": { name: "Config status" },
	"vitals.evse_state": { name: "EVSE State" },
	"vitals.evse_state_Text": { name: "EVSE State (Text)" },
	"vitals.current_alerts": { name: "Current Alerts" },
	"vitals.relay_k2_v": { name: "Relay K2 Voltage", role: "value.voltage", unit: "V" },
	"vitals.relay_k1_v": { name: "Relay K1 Voltage", role: "value.voltage", unit: "V" },
};

module.exports = state_attr;
