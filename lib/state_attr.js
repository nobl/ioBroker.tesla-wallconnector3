// State attributes

const state_attr = {
	"version.firmware_version": {
		name: "Firmware version",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"version.part_number": {
		name: "Part number",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"version.serial_number": {
		name: "Serial number",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.contactor_cycles": {
		name: "Contactor cycles",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.contactor_cycles_loaded": {
		name: "Contactor cycles loaded",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.alert_count": {
		name: "Alert count",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.thermal_foldbacks": {
		name: "Thermal foldbacks",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.avg_startup_temp": {
		name: "Average startup temperature",
		unit: "°C",
		booltype: false,
		multiply: 1
	},
	"lifetime.charge_starts": {
		name: "Charge starts",
		unit: "%",
		booltype: false,
		multiply: 1
	},
	"lifetime.energy_wh": {
		name: "Energy",
		unit: "Wh",
		booltype: false,
		multiply: 1
	},
	"lifetime.connector_cycles": {
		name: "Connector cycles",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"lifetime.uptime_s": {
		name: "Uptime",
		unit: "s",
		booltype: false,
		multiply: 1
	},
	"lifetime.charging_time_s": {
		name: "Charging time",
		unit: "s",
		booltype: false,
		multiply: 1
	},
	"wifi_status.wifi_ssid": {
		name: "SSID",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"wifi_status.wifi_signal_strength": {
		name: "WiFi Signal Strength",
		unit: "dBm",
		booltype: false,
		multiply: 1
	},
	"wifi_status.wifi_rssi": {
		name: "WiFi RSSI",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"wifi_status.wifi_snr": {
		name: "WiFi Signal Noise Ration",
		unit: "dB",
		booltype: false,
		multiply: 1
	},
	"wifi_status.wifi_connected": {
		name: "WiFi connected",
		unit: "",
		booltype: true,
		multiply: 1
	},
	"wifi_status.wifi_infra_ip": {
		name: "WiFi IP",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"wifi_status.internet": {
		name: "WiFi Internet",
		unit: "",
		booltype: true,
		multiply: 1
	},
	"wifi_status.wifi_mac": {
		name: "WiFi MAC Address",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"vitals.contactor_closed": {
		name: "Contactor closed",
		unit: "",
		booltype: true,
		multiply: 1
	},
	"vitals.vehicle_connected": {
		name: "Vehicle connected",
		unit: "",
		booltype: true,
		multiply: 1
	},
	"vitals.session_s": {
		name: "Session time",
		unit: "s",
		booltype: false,
		multiply: 1
	},
	"vitals.grid_v": {
		name: "Grid voltage",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.grid_hz": {
		name: "Grid frequency",
		unit: "Hz",
		booltype: false,
		multiply: 1
	},
	"vitals.vehicle_current_a": {
		name: "Vehicle Current",
		unit: "A",
		booltype: false,
		multiply: 1
	},
	"vitals.currentA_a": {
		name: "Current Line A",
		unit: "A",
		booltype: false,
		multiply: 1
	},
	"vitals.currentB_a": {
		name: "Current Line B",
		unit: "A",
		booltype: false,
		multiply: 1
	},
	"vitals.currentC_a": {
		name: "Current Line C",
		unit: "A",
		booltype: false,
		multiply: 1
	},
	"vitals.currentN_a": {
		name: "Current Line N",
		unit: "A",
		booltype: false,
		multiply: 1
	},
	"vitals.voltageA_v": {
		name: "Voltage Line A",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.voltageB_v": {
		name: "Voltage Line B",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.voltageC_v": {
		name: "Voltage Line C",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.relay_coil_v": {
		name: "Relais coil",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.pcba_temp_c": {
		name: "Board Temperature",
		unit: "°C",
		booltype: false,
		multiply: 1
	},
	"vitals.handle_temp_c": {
		name: "Handle Temperature",
		unit: "°C",
		booltype: false,
		multiply: 1
	},
	"vitals.mcu_temp_c": {
		name: "MCU Temperature",
		unit: "°C",
		booltype: false,
		multiply: 1
	},
	"vitals.uptime_s": {
		name: "Uptime",
		unit: "s",
		booltype: false,
		multiply: 1
	},
	"vitals.input_thermopile_uv": {
		name: "Input Thermopile UV",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"vitals.prox_v": {
		name: "Prox",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.pilot_high_v": {
		name: "Pilot High",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.pilot_low_v": {
		name: "Pilot Low",
		unit: "V",
		booltype: false,
		multiply: 1
	},
	"vitals.session_energy_wh": {
		name: "Session energy",
		unit: "Wh",
		booltype: false,
		multiply: 1
	},
	"vitals.config_status": {
		name: "Config status",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"vitals.evse_state": {
		name: "EVSE State",
		unit: "",
		booltype: false,
		multiply: 1
	},
	"vitals.current_alerts": {
		name: "Current Alerts",
		unit: "",
		booltype: false,
		multiply: 1
	},

};

module.exports = state_attr;
