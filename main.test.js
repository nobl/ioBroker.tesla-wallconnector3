"use strict";

const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

// Mock adapter-core so main.js can be loaded without ioBroker
const mainExport = proxyquire("./main", {
	"@iobroker/adapter-core": {
		Adapter: class {
			constructor() {}
			on() {}
			setState() {}
			setStateChangedAsync() {
				return Promise.resolve();
			}
			getObjectAsync() {
				return Promise.resolve(null);
			}
			setObjectNotExistsAsync() {
				return Promise.resolve();
			}
			extendObject() {
				return Promise.resolve();
			}
			delObjectAsync() {
				return Promise.resolve();
			}
			getForeignObjectAsync() {
				return Promise.resolve(null);
			}
			setTimeout(fn, ms) {
				return { _fn: fn, _ms: ms };
			}
			clearTimeout() {}
		},
	},
});

const t = mainExport._testing;
const state_attr = require("./lib/state_attr.js");

function createInstance(config = {}) {
	const defaults = {
		teslawb3ip: "192.168.1.100",
		interval: 10,
		pollingTimeout: 5000,
		retries: 10,
		retrymultiplier: 2,
		splitPhase: false,
	};
	const instance = mainExport();
	instance.config = { ...defaults, ...config };
	instance.log = {
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
		silly: () => {},
	};
	return instance;
}

// ---------------------------------------------------------------------------
// state_attr
// ---------------------------------------------------------------------------
describe("state_attr", () => {
	it("should have a name for each entry", () => {
		for (const [key, attr] of Object.entries(state_attr)) {
			assert.equal(typeof attr.name, "string", `${key}: name should be a string`);
		}
	});

	it("should only contain valid optional properties", () => {
		const validKeys = new Set(["name", "role", "unit", "booltype", "multiply"]);
		for (const [key, attr] of Object.entries(state_attr)) {
			for (const prop of Object.keys(attr)) {
				assert.ok(validKeys.has(prop), `${key}: unexpected property "${prop}"`);
			}
		}
	});

	it("should have specific roles for voltage, current, temperature, and energy states", () => {
		assert.equal(state_attr["vitals.grid_v"].role, "value.voltage");
		assert.equal(state_attr["vitals.currentA_a"].role, "value.current");
		assert.equal(state_attr["vitals.pcba_temp_c"].role, "value.temperature");
		assert.equal(state_attr["vitals.session_energy_wh"].role, "value.energy");
		assert.equal(state_attr["vitals.vehicle_connected"].role, "indicator.connected");
	});

	it("should have version endpoint entries", () => {
		assert.ok(state_attr["version.firmware_version"]);
		assert.ok(state_attr["version.serial_number"]);
		assert.ok(state_attr["version.part_number"]);
	});

	it("should have vitals endpoint entries", () => {
		assert.ok(state_attr["vitals.evse_state"]);
		assert.ok(state_attr["vitals.vehicle_connected"]);
		assert.ok(state_attr["vitals.grid_v"]);
	});

	it("should mark boolean fields with booltype", () => {
		assert.equal(state_attr["vitals.contactor_closed"].booltype, true);
		assert.equal(state_attr["vitals.vehicle_connected"].booltype, true);
		assert.equal(state_attr["wifi_status.wifi_connected"].booltype, true);
		assert.equal(state_attr["wifi_status.internet"].booltype, true);
	});

	it("should not mark non-boolean fields with booltype", () => {
		assert.ok(!state_attr["vitals.grid_v"].booltype);
		assert.ok(!state_attr["vitals.evse_state"].booltype);
		assert.ok(!state_attr["version.firmware_version"].booltype);
	});

	it("should have json role for array states", () => {
		assert.equal(state_attr["vitals.current_alerts"].role, "json");
		assert.equal(state_attr["vitals.evse_not_ready_reasons"].role, "json");
	});

	it("should have correct wifi signal metadata", () => {
		assert.equal(state_attr["wifi_status.wifi_rssi"].unit, "dBm");
		assert.ok(!state_attr["wifi_status.wifi_signal_strength"].unit);
	});
});

// ---------------------------------------------------------------------------
// state_trans
// ---------------------------------------------------------------------------
describe("state_trans", () => {
	const state_trans = require("./lib/state_trans.js");

	it("should have English translations for evse_state", () => {
		const table = state_trans["vitals.evse_state.en"];
		assert.ok(table, "English evse_state translations should exist");
		assert.equal(typeof table[0], "string");
		assert.equal(typeof table[1], "string");
	});

	it("should have German translations for evse_state", () => {
		const table = state_trans["vitals.evse_state.de"];
		assert.ok(table, "German evse_state translations should exist");
		assert.equal(typeof table[0], "string");
	});
});

// ---------------------------------------------------------------------------
// valueTyping
// ---------------------------------------------------------------------------
describe("valueTyping", () => {
	it("converts numeric strings to numbers", () => {
		assert.equal(t.valueTyping("unknown.key", "42"), 42);
		assert.equal(t.valueTyping("unknown.key", " 3.14 "), 3.14);
		assert.equal(t.valueTyping("unknown.key", "-10"), -10);
		assert.equal(t.valueTyping("unknown.key", "0"), 0);
	});

	it("leaves non-numeric strings as strings", () => {
		assert.equal(t.valueTyping("unknown.key", "hello"), "hello");
		assert.equal(t.valueTyping("unknown.key", ""), "");
		assert.equal(t.valueTyping("unknown.key", " "), " ");
	});

	it("passes through numbers as-is for unknown keys", () => {
		assert.equal(t.valueTyping("unknown.key", 123), 123);
		assert.equal(t.valueTyping("unknown.key", 0), 0);
		assert.equal(t.valueTyping("unknown.key", -5.5), -5.5);
	});

	it("converts to boolean when booltype is set", () => {
		assert.equal(t.valueTyping("vitals.vehicle_connected", true), true);
		assert.equal(t.valueTyping("vitals.vehicle_connected", false), false);
		assert.equal(t.valueTyping("vitals.vehicle_connected", 1), true);
		assert.equal(t.valueTyping("vitals.vehicle_connected", 0), false);
		assert.equal(t.valueTyping("vitals.vehicle_connected", "true"), true);
		assert.equal(t.valueTyping("vitals.vehicle_connected", "false"), false);
		assert.equal(t.valueTyping("vitals.vehicle_connected", "1"), true);
		assert.equal(t.valueTyping("vitals.vehicle_connected", "0"), false);
		assert.equal(t.valueTyping("vitals.vehicle_connected", ""), false);
	});

	it("passes through values when no multiply is set", () => {
		assert.equal(t.valueTyping("vitals.grid_v", 230.5), 230.5);
		assert.equal(t.valueTyping("lifetime.energy_wh", 12345), 12345);
	});

	it("returns value unchanged for keys not in state_attr", () => {
		assert.equal(t.valueTyping("totally.unknown", "abc"), "abc");
		assert.equal(t.valueTyping("totally.unknown", 99), 99);
		assert.equal(t.valueTyping("totally.unknown", true), true);
	});

	it("keeps Infinity as a string", () => {
		assert.equal(t.valueTyping("unknown.key", "Infinity"), "Infinity");
	});

	it("keeps -Infinity as a string", () => {
		assert.equal(t.valueTyping("unknown.key", "-Infinity"), "-Infinity");
	});

	it("keeps NaN as a string", () => {
		assert.equal(t.valueTyping("unknown.key", "NaN"), "NaN");
	});

	it("converts hex strings to numbers", () => {
		assert.equal(t.valueTyping("unknown.key", "0x1F"), 31);
	});

	it("converts scientific notation to numbers", () => {
		assert.equal(t.valueTyping("unknown.key", "1e3"), 1000);
	});
});

// ---------------------------------------------------------------------------
// applyTyping
// ---------------------------------------------------------------------------
describe("applyTyping", () => {
	it("passes through values when no multiply is set", () => {
		assert.equal(t.applyTyping(230.5, {}), 230.5);
		assert.equal(t.applyTyping(230.5, { multiply: 1 }), 230.5);
	});

	it("applies multiply factor", () => {
		assert.equal(t.applyTyping(1000, { multiply: 0.001 }), 1);
		assert.equal(t.applyTyping(5000, { multiply: 0.001 }), 5);
		assert.equal(t.applyTyping(42, { multiply: 2 }), 84);
	});

	it("does not apply multiply to non-numbers", () => {
		assert.equal(t.applyTyping("1000", { multiply: 0.001 }), "1000");
	});

	it("converts to boolean when booltype is set", () => {
		assert.equal(t.applyTyping(1, { booltype: true }), true);
		assert.equal(t.applyTyping(0, { booltype: true }), false);
		assert.equal(t.applyTyping("true", { booltype: true }), true);
		assert.equal(t.applyTyping("false", { booltype: true }), false);
	});
});

// ---------------------------------------------------------------------------
// guessRole
// ---------------------------------------------------------------------------
describe("guessRole", () => {
	it("returns indicator for read-only booleans", () => {
		assert.equal(t.guessRole("boolean", false), "indicator");
	});

	it("returns switch for writable booleans", () => {
		assert.equal(t.guessRole("boolean", true), "switch");
	});

	it("returns value for numbers", () => {
		assert.equal(t.guessRole("number", false), "value");
	});

	it("returns text for strings and other types", () => {
		assert.equal(t.guessRole("string", false), "text");
		assert.equal(t.guessRole("mixed", false), "text");
	});
});

// ---------------------------------------------------------------------------
// calcPowerValue
// ---------------------------------------------------------------------------
describe("calcPowerValue", () => {
	it("calculates three valid phases", () => {
		const obj = {
			voltageA_v: 230,
			currentA_a: 10,
			voltageB_v: 231,
			currentB_a: 10,
			voltageC_v: 229,
			currentC_a: 10,
		};
		assert.equal(t.calcPowerValue(obj, false), 6900);
	});

	it("calculates one valid phase with two absent pairs", () => {
		const obj = { voltageA_v: 230, currentA_a: 10 };
		assert.equal(t.calcPowerValue(obj, false), 2300);
	});

	it("returns 0 when all currents are zero", () => {
		const obj = {
			voltageA_v: 230,
			currentA_a: 0,
			voltageB_v: 231,
			currentB_a: 0,
			voltageC_v: 229,
			currentC_a: 0,
		};
		assert.equal(t.calcPowerValue(obj, false), 0);
	});

	it("returns null when voltage present but current missing", () => {
		const obj = { voltageA_v: 230 };
		assert.equal(t.calcPowerValue(obj, false), null);
	});

	it("returns null when current present but voltage missing", () => {
		const obj = { currentA_a: 10 };
		assert.equal(t.calcPowerValue(obj, false), null);
	});

	it("returns null for NaN input", () => {
		const obj = { voltageA_v: NaN, currentA_a: 10 };
		assert.equal(t.calcPowerValue(obj, false), null);
	});

	it("returns null for Infinity input", () => {
		const obj = { voltageA_v: Infinity, currentA_a: 10 };
		assert.equal(t.calcPowerValue(obj, false), null);
	});

	it("handles negative values mathematically", () => {
		const obj = { voltageA_v: 230, currentA_a: -5 };
		assert.equal(t.calcPowerValue(obj, false), -1150);
	});

	it("returns null when no phase data at all", () => {
		assert.equal(t.calcPowerValue({}, false), null);
	});

	it("returns null for non-numeric string values", () => {
		const obj = { voltageA_v: "abc", currentA_a: 10 };
		assert.equal(t.calcPowerValue(obj, false), null);
	});

	it("calculates split-phase power", () => {
		const obj = { grid_v: 240, vehicle_current_a: 32 };
		assert.equal(t.calcPowerValue(obj, true), 7680);
	});

	it("returns null for split-phase with missing grid_v", () => {
		const obj = { vehicle_current_a: 32 };
		assert.equal(t.calcPowerValue(obj, true), null);
	});

	it("returns null for split-phase with missing vehicle_current_a", () => {
		const obj = { grid_v: 240 };
		assert.equal(t.calcPowerValue(obj, true), null);
	});

	it("returns null for split-phase with non-finite input", () => {
		const obj = { grid_v: NaN, vehicle_current_a: 32 };
		assert.equal(t.calcPowerValue(obj, true), null);
	});

	it("calculates split-phase zero power", () => {
		const obj = { grid_v: 240, vehicle_current_a: 0 };
		assert.equal(t.calcPowerValue(obj, true), 0);
	});
});

// ---------------------------------------------------------------------------
// decodeTeslaResponse
// ---------------------------------------------------------------------------
describe("decodeTeslaResponse", () => {
	it("parses valid JSON", () => {
		const obj = t.decodeTeslaResponse('{"evse_state": 1, "grid_v": 230}', "vitals");
		assert.deepEqual(obj, { evse_state: 1, grid_v: 230 });
	});

	it("handles bare nan values", () => {
		const obj = t.decodeTeslaResponse('{"evse_state": 1, "grid_v": nan}', "vitals");
		assert.deepEqual(obj, { evse_state: 1, grid_v: null });
	});

	it("handles case-insensitive NaN", () => {
		const obj = t.decodeTeslaResponse('{"evse_state": 1, "grid_v": NaN}', "vitals");
		assert.deepEqual(obj, { evse_state: 1, grid_v: null });
	});

	it("handles missing final brace", () => {
		const obj = t.decodeTeslaResponse(
			'{"firmware_version": "1.2.3", "serial_number": "ABC"',
			"version",
		);
		assert.deepEqual(obj, { firmware_version: "1.2.3", serial_number: "ABC" });
	});

	it("handles nan + missing brace combined", () => {
		const obj = t.decodeTeslaResponse(
			'{"firmware_version": "1.2.3", "serial_number": nan',
			"version",
		);
		assert.deepEqual(obj, { firmware_version: "1.2.3", serial_number: null });
	});

	it("throws on irreparably malformed JSON", () => {
		assert.throws(() => t.decodeTeslaResponse("{invalid json{{", "vitals"), /unparseable/);
	});

	it("throws on HTML body", () => {
		assert.throws(
			() => t.decodeTeslaResponse("<html><body>Error</body></html>", "vitals"),
			/not JSON/,
		);
	});

	it("throws on string body", () => {
		assert.throws(() => t.decodeTeslaResponse('"just a string"', "vitals"), /not JSON/);
	});

	it("throws on null JSON", () => {
		assert.throws(() => t.decodeTeslaResponse("null", "vitals"), /not JSON/);
	});

	it("throws on array body", () => {
		assert.throws(() => t.decodeTeslaResponse("[1, 2, 3]", "vitals"), /array/);
	});

	it("throws on empty object", () => {
		assert.throws(() => t.decodeTeslaResponse("{}", "vitals"), /empty/);
	});

	it("throws on implausible object", () => {
		assert.throws(
			() => t.decodeTeslaResponse('{"error": "failed"}', "vitals"),
			/missing expected/,
		);
	});

	it("throws on empty string", () => {
		assert.throws(() => t.decodeTeslaResponse("", "vitals"), /empty/);
	});

	it("throws on non-string input", () => {
		assert.throws(() => t.decodeTeslaResponse(null, "vitals"), /not a string/);
	});

	it("accepts response for unknown endpoints without field check", () => {
		const obj = t.decodeTeslaResponse('{"foo": "bar"}', "unknown_endpoint");
		assert.deepEqual(obj, { foo: "bar" });
	});
});

// ---------------------------------------------------------------------------
// SSID raw value preservation
// ---------------------------------------------------------------------------
describe("SSID raw value preservation", () => {
	it("preserves exact API value without decoding", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		const encoded = Buffer.from("MyNetwork").toString("base64");
		await instance.evalPoll({ wifi_ssid: encoded }, "wifi_status");
		assert.equal(states["wifi_status.wifi_ssid"], encoded);
	});

	it("preserves plaintext SSID as-is", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ wifi_ssid: "MyNetwork" }, "wifi_status");
		assert.equal(states["wifi_status.wifi_ssid"], "MyNetwork");
	});

	it("does not convert numeric SSID to number", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ wifi_ssid: "1234" }, "wifi_status");
		assert.equal(states["wifi_status.wifi_ssid"], "1234");
		assert.equal(typeof states["wifi_status.wifi_ssid"], "string");
	});
});

// ---------------------------------------------------------------------------
// repairBareNan
// ---------------------------------------------------------------------------
describe("repairBareNan", () => {
	it("replaces bare nan as object value", () => {
		assert.equal(t.repairBareNan('{"grid_v": nan}'), '{"grid_v": null}');
	});

	it("replaces case-insensitive NaN", () => {
		assert.equal(t.repairBareNan('{"v": NaN}'), '{"v": null}');
		assert.equal(t.repairBareNan('{"v": NAN}'), '{"v": null}');
		assert.equal(t.repairBareNan('{"v": Nan}'), '{"v": null}');
	});

	it("replaces nan in array", () => {
		assert.equal(t.repairBareNan('{"arr": [nan]}'), '{"arr": [null]}');
		assert.equal(t.repairBareNan("[nan, nan]"), "[null, null]");
	});

	it("does not replace nan inside strings", () => {
		const input = '{"val": "nan"}';
		assert.equal(t.repairBareNan(input), input);
	});

	it("does not replace nan in strings alongside bare nan", () => {
		const input = '{"reason": "reason: nan detected", "v": nan}';
		assert.equal(t.repairBareNan(input), '{"reason": "reason: nan detected", "v": null}');
	});

	it("handles escaped quotes and backslashes", () => {
		const input = '{"val": "test\\\\\\"nan", "v": nan}';
		const result = t.repairBareNan(input);
		assert.ok(result.endsWith('"v": null}'));
		assert.ok(result.includes('\\\\\\"nan"'));
	});

	it("does not replace nan as object key", () => {
		const input = "{nan: 1}";
		assert.equal(t.repairBareNan(input), input);
	});

	it("replaces multiple nan values", () => {
		assert.equal(t.repairBareNan('{"a":nan,"b":nan}'), '{"a":null,"b":null}');
	});

	it("returns valid JSON unchanged", () => {
		const input = '{"a": 1, "b": "hello"}';
		assert.equal(t.repairBareNan(input), input);
	});
});

// ---------------------------------------------------------------------------
// canRepairMissingBrace
// ---------------------------------------------------------------------------
describe("canRepairMissingBrace", () => {
	it("returns true for single missing brace", () => {
		assert.equal(t.canRepairMissingBrace('{"a": 1'), true);
	});

	it("returns true for nested with one missing brace", () => {
		assert.equal(t.canRepairMissingBrace('{"a": {"b": 1}'), true);
	});

	it("returns false for two missing braces", () => {
		assert.equal(t.canRepairMissingBrace('{"a": {"b": 1'), false);
	});

	it("returns false for balanced braces", () => {
		assert.equal(t.canRepairMissingBrace('{"a": 1}'), false);
	});

	it("returns false for unterminated string", () => {
		assert.equal(t.canRepairMissingBrace('{"a": "hello'), false);
	});

	it("returns false for unbalanced brackets", () => {
		assert.equal(t.canRepairMissingBrace('{"a": [1'), false);
	});

	it("handles braces inside strings correctly", () => {
		assert.equal(t.canRepairMissingBrace('{"a": "}{}{"}'), false);
		assert.equal(t.canRepairMissingBrace('{"a": "}{}{"'), true);
	});
});

// ---------------------------------------------------------------------------
// validateHost
// ---------------------------------------------------------------------------
describe("validateHost", () => {
	it("accepts valid IPv4", () => {
		assert.equal(t.validateHost("192.168.1.100"), "192.168.1.100");
	});

	it("accepts valid FQDN", () => {
		assert.equal(t.validateHost("wallbox.local"), "wallbox.local");
	});

	it("accepts simple hostname", () => {
		assert.equal(t.validateHost("wallbox"), "wallbox");
	});

	it("trims whitespace", () => {
		assert.equal(t.validateHost("  192.168.1.100  "), "192.168.1.100");
	});

	it("rejects empty string", () => {
		assert.equal(t.validateHost(""), null);
	});

	it("rejects 0.0.0.0", () => {
		assert.equal(t.validateHost("0.0.0.0"), null);
	});

	it("rejects scheme", () => {
		assert.equal(t.validateHost("http://192.168.1.100"), null);
	});

	it("rejects credentials", () => {
		assert.equal(t.validateHost("user@192.168.1.100"), null);
	});

	it("rejects path", () => {
		assert.equal(t.validateHost("192.168.1.100/path"), null);
	});

	it("rejects query", () => {
		assert.equal(t.validateHost("192.168.1.100?x=1"), null);
	});

	it("rejects fragment", () => {
		assert.equal(t.validateHost("192.168.1.100#frag"), null);
	});

	it("rejects port", () => {
		assert.equal(t.validateHost("192.168.1.100:8080"), null);
	});

	it("rejects whitespace in host", () => {
		assert.equal(t.validateHost("host name"), null);
	});

	it("rejects non-string", () => {
		assert.equal(t.validateHost(null), null);
		assert.equal(t.validateHost(undefined), null);
		assert.equal(t.validateHost(42), null);
	});

	it("rejects label starting with hyphen", () => {
		assert.equal(t.validateHost("-wallbox"), null);
	});

	it("rejects label ending with hyphen", () => {
		assert.equal(t.validateHost("wallbox-"), null);
	});

	it("rejects bracketed IPv6", () => {
		assert.equal(t.validateHost("[::1]"), null);
	});

	it("rejects too-long hostname", () => {
		assert.equal(t.validateHost("a".repeat(254)), null);
	});

	it("accepts hostname with underscores", () => {
		assert.equal(t.validateHost("TESLA_WALLBOX"), "TESLA_WALLBOX");
		assert.equal(t.validateHost("wall_box_1.local"), "wall_box_1.local");
	});

	it("rejects trailing-dot FQDN", () => {
		assert.equal(t.validateHost("wallbox.local."), null);
	});
});

// ---------------------------------------------------------------------------
// checkConfig
// ---------------------------------------------------------------------------
describe("checkConfig", () => {
	it("rejects empty IP", () => {
		const instance = createInstance({ teslawb3ip: "" });
		assert.equal(instance.checkConfig(), false);
	});

	it("rejects whitespace-only IP", () => {
		const instance = createInstance({ teslawb3ip: "   " });
		assert.equal(instance.checkConfig(), false);
	});

	it("rejects legacy 0.0.0.0", () => {
		const instance = createInstance({ teslawb3ip: "0.0.0.0" });
		assert.equal(instance.checkConfig(), false);
	});

	it("accepts valid IPv4", () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100" });
		assert.equal(instance.checkConfig(), true);
		assert.equal(instance.url, "http://192.168.1.100/api/1/");
	});

	it("accepts valid FQDN", () => {
		const instance = createInstance({ teslawb3ip: "wallbox.local" });
		assert.equal(instance.checkConfig(), true);
		assert.equal(instance.url, "http://wallbox.local/api/1/");
	});

	it("trims whitespace from IP", () => {
		const instance = createInstance({ teslawb3ip: " 192.168.1.100 " });
		assert.equal(instance.checkConfig(), true);
		assert.equal(instance.url, "http://192.168.1.100/api/1/");
	});

	it("clamps invalid interval to default", () => {
		const instance = createInstance({ interval: -5 });
		instance.checkConfig();
		assert.equal(instance.config.interval, 10);
	});

	it("clamps invalid timeout to default", () => {
		const instance = createInstance({ pollingTimeout: 999999 });
		instance.checkConfig();
		assert.equal(instance.config.pollingTimeout, 5000);
	});

	it("rejects host with scheme", () => {
		const instance = createInstance({ teslawb3ip: "http://192.168.1.100" });
		assert.equal(instance.checkConfig(), false);
	});

	it("rejects host with credentials", () => {
		const instance = createInstance({ teslawb3ip: "admin@192.168.1.100" });
		assert.equal(instance.checkConfig(), false);
	});

	it("rejects host with path", () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100/admin" });
		assert.equal(instance.checkConfig(), false);
	});

	it("rejects host with port", () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100:8080" });
		assert.equal(instance.checkConfig(), false);
	});

	it("logs specific message for invalid host vs unconfigured", () => {
		const warnings = [];
		const instance = createInstance({ teslawb3ip: "http://evil" });
		instance.log.warn = (msg) => warnings.push(msg);
		instance.checkConfig();
		assert.ok(warnings.some((m) => m.includes("invalid")));

		const warnings2 = [];
		const instance2 = createInstance({ teslawb3ip: "" });
		instance2.log.warn = (msg) => warnings2.push(msg);
		instance2.checkConfig();
		assert.ok(warnings2.some((m) => m.includes("not configured")));
	});
});

// ---------------------------------------------------------------------------
// retry logic
// ---------------------------------------------------------------------------
describe("retry logic", () => {
	it("retries=0 gives no retry on failure", async () => {
		const instance = createInstance({ retries: 0 });
		instance.url = "http://192.168.1.100/api/1/";
		instance.doGet = async () => {
			throw new Error("fail");
		};

		let pollDelay = null;
		instance.setNextPoll = (delay) => {
			pollDelay = delay;
			return {};
		};

		await instance.readTeslaWC3();

		assert.equal(pollDelay, 10000);
		assert.equal(instance.retry, 0);
		assert.equal(instance.connected, false);
	});

	it("retries=1 allows exactly one retry", async () => {
		const instance = createInstance({ retries: 1 });
		instance.url = "http://192.168.1.100/api/1/";
		instance.doGet = async () => {
			throw new Error("fail");
		};

		const delays = [];
		instance.setNextPoll = (delay) => {
			delays.push(delay);
			return {};
		};

		await instance.readTeslaWC3();
		assert.equal(instance.retry, 1);
		assert.ok(delays[0] > 10000);

		await instance.readTeslaWC3();
		assert.equal(instance.retry, 0);
		assert.equal(delays[1], 10000);
	});

	it("retries=10 allows exactly ten retries", async () => {
		const instance = createInstance({ retries: 10 });
		instance.url = "http://192.168.1.100/api/1/";
		instance.doGet = async () => {
			throw new Error("fail");
		};

		const delays = [];
		instance.setNextPoll = (delay) => {
			delays.push(delay);
			return {};
		};

		for (let i = 0; i < 10; i++) {
			await instance.readTeslaWC3();
			assert.equal(instance.retry, i + 1);
		}

		await instance.readTeslaWC3();
		assert.equal(instance.retry, 0);
		assert.equal(delays[10], 10000);
	});

	it("retries=999 means unlimited", async () => {
		const instance = createInstance({ retries: 999 });
		instance.url = "http://192.168.1.100/api/1/";
		instance.doGet = async () => {
			throw new Error("fail");
		};

		let lastDelay = 0;
		instance.setNextPoll = (delay) => {
			lastDelay = delay;
			return {};
		};

		for (let i = 0; i < 50; i++) {
			await instance.readTeslaWC3();
		}
		assert.equal(instance.retry, 50);
		assert.ok(lastDelay > 0);
		assert.ok(lastDelay <= 3600000);
	});

	it("successful retry resets state", async () => {
		const instance = createInstance({ retries: 10 });
		instance.url = "http://192.168.1.100/api/1/";

		let failCycles = 3;
		instance.doGet = async (url) => {
			if (failCycles > 0) {
				throw new Error("fail");
			}
			const ep = url.split("/").pop();
			if (ep === "vitals") {
				return '{"evse_state": 1, "grid_v": 230}';
			}
			if (ep === "lifetime") {
				return '{"uptime_s": 1000, "energy_wh": 5000}';
			}
			if (ep === "wifi_status") {
				return '{"wifi_ssid": "dGVzdA==", "wifi_connected": true}';
			}
			if (ep === "version") {
				return '{"firmware_version": "1.0", "serial_number": "ABC"}';
			}
			throw new Error("unknown");
		};

		instance.setNextPoll = () => ({});

		for (let i = 0; i < 3; i++) {
			await instance.readTeslaWC3();
			failCycles--;
		}
		assert.equal(instance.retry, 3);

		await instance.readTeslaWC3();
		assert.equal(instance.retry, 0);
		assert.equal(instance.connected, true);
	});

	it("exhaustion sets connected=false", async () => {
		const instance = createInstance({ retries: 1 });
		instance.url = "http://192.168.1.100/api/1/";
		instance.connected = true;
		instance.doGet = async () => {
			throw new Error("fail");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();
		await instance.readTeslaWC3();

		assert.equal(instance.connected, false);
	});
});

// ---------------------------------------------------------------------------
// unload race
// ---------------------------------------------------------------------------
describe("unload race", () => {
	it("unload during requests prevents state changes", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const connectionStates = [];
		instance.setState = (id, val) => {
			if (id === "info.connection") connectionStates.push(val);
		};

		let firstCall = true;
		instance.doGet = async () => {
			if (firstCall) {
				firstCall = false;
				instance.unloaded = true;
				instance.connected = false;
			}
			return '{"evse_state": 1, "grid_v": 230}';
		};

		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.equal(instance.connected, false);
		assert.ok(!connectionStates.includes(true));
	});

	it("no timer scheduled after unload", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.unloaded = true;

		let timerSet = false;
		instance.setNextPoll = () => {
			timerSet = true;
			return {};
		};
		instance.doGet = async () => '{"evse_state": 1, "grid_v": 230}';

		await instance.readTeslaWC3();

		assert.equal(timerSet, false);
	});

	it("doState is a no-op after unload", async () => {
		const instance = createInstance();
		instance.unloaded = true;

		let setCalled = false;
		instance.setStateChangedAsync = async () => {
			setCalled = true;
		};

		await instance.doState("test.key", 42, "Test", "", false);
		assert.equal(setCalled, false);
	});

	it("post-loop guard prevents connection=true after unload during last endpoint", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const connectionStates = [];
		instance.setState = (id, val) => {
			if (id === "info.connection") { connectionStates.push(val); }
		};

		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			if (ep === "vitals") {
				instance.unloaded = true;
				instance.connected = false;
			}
			if (ep === "vitals") { return '{"evse_state": 1, "grid_v": 230}'; }
			if (ep === "lifetime") { return '{"uptime_s": 1000, "energy_wh": 5000}'; }
			if (ep === "wifi_status") { return '{"wifi_ssid": "dGVzdA==", "wifi_connected": true}'; }
			if (ep === "version") { return '{"firmware_version": "1.0", "serial_number": "ABC"}'; }
			throw new Error("unknown");
		};

		let timerSet = false;
		instance.setNextPoll = () => {
			timerSet = true;
			return {};
		};

		await instance.readTeslaWC3();

		assert.equal(instance.connected, false);
		assert.ok(!connectionStates.includes(true));
		assert.equal(timerSet, false);
	});

	it("onUnload sets connected=false", () => {
		const instance = createInstance();
		instance.connected = true;

		instance.onUnload(() => {});

		assert.equal(instance.connected, false);
		assert.equal(instance.unloaded, true);
	});
});

// ---------------------------------------------------------------------------
// endpoint scheduling
// ---------------------------------------------------------------------------
describe("endpoint scheduling", () => {
	it("polls all endpoints on startup", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "lifetime") return '{"uptime_s": 1000, "energy_wh": 5000}';
			if (ep === "wifi_status") return '{"wifi_ssid": "dGVzdA==", "wifi_connected": true}';
			if (ep === "version") return '{"firmware_version": "1.0", "serial_number": "ABC"}';
			throw new Error("unknown endpoint");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.deepEqual(polledEndpoints.sort(), ["lifetime", "version", "vitals", "wifi_status"]);
	});

	it("skips slow endpoints on subsequent fast cycles", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const now = Date.now();
		instance.lastFetch = {
			vitals: now - 11000,
			lifetime: now - 30000,
			wifi_status: now - 30000,
			version: now - 1800000,
		};
		instance.connected = true;
		instance.retry = 0;

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			throw new Error("unexpected");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.deepEqual(polledEndpoints, ["vitals"]);
	});

	it("refreshes version after reconnect", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.retry = 3;

		const now = Date.now();
		instance.lastFetch = {
			vitals: now - 11000,
			lifetime: now - 30000,
			wifi_status: now - 30000,
			version: now - 1000,
		};

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "version") return '{"firmware_version": "1.0", "serial_number": "ABC"}';
			throw new Error("not due");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.ok(polledEndpoints.includes("version"));
	});

	it("polls slow endpoints when their interval expires", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.connected = true;
		instance.retry = 0;

		const now = Date.now();
		instance.lastFetch = {
			vitals: now - 11000,
			lifetime: now - 61000,
			wifi_status: now - 30000,
			version: now - 1800000,
		};

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "lifetime") return '{"uptime_s": 1000, "energy_wh": 5000}';
			throw new Error("not due");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.ok(polledEndpoints.includes("vitals"));
		assert.ok(polledEndpoints.includes("lifetime"));
		assert.ok(!polledEndpoints.includes("wifi_status"));
	});

	it("retries failed endpoint on next cycle", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.connected = true;
		instance.retry = 0;

		const now = Date.now();
		instance.lastFetch = {
			vitals: now - 11000,
			wifi_status: now - 30000,
			version: now - 1800000,
		};

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "lifetime") return '{"uptime_s": 1000, "energy_wh": 5000}';
			throw new Error("not due");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.ok(polledEndpoints.includes("lifetime"));
	});

	it("hourly version refresh", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.connected = true;
		instance.retry = 0;

		const now = Date.now();
		instance.lastFetch = {
			vitals: now - 11000,
			lifetime: now - 30000,
			wifi_status: now - 30000,
			version: now - 3601000,
		};

		const polledEndpoints = [];
		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			polledEndpoints.push(ep);
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "version") return '{"firmware_version": "1.0", "serial_number": "ABC"}';
			throw new Error("not due");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.ok(polledEndpoints.includes("version"));
	});
});

// ---------------------------------------------------------------------------
// all endpoints invalid / mixed
// ---------------------------------------------------------------------------
describe("invalid endpoint responses", () => {
	it("sets connected=false when all return invalid bodies", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		instance.doGet = async () => "<html>error</html>";
		instance.setNextPoll = () => ({});

		let connState = null;
		instance.setState = (id, val) => {
			if (id === "info.connection") connState = val;
		};

		await instance.readTeslaWC3();

		assert.equal(connState, false);
		assert.equal(instance.connected, false);
	});

	it("processes valid endpoints and warns on failed ones", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const warnings = [];
		instance.log.warn = (msg) => warnings.push(msg);

		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			return "<html>error</html>";
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();

		assert.equal(instance.connected, true);
		assert.ok(warnings.length > 0);
	});
});

// ---------------------------------------------------------------------------
// array state handling
// ---------------------------------------------------------------------------
describe("array state handling", () => {
	it("publishes canonical JSON and child states for arrays", async () => {
		const instance = createInstance();

		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ current_alerts: ["a", "b"] }, "vitals");

		assert.equal(states["vitals.current_alerts"], '["a","b"]');
		assert.equal(states["vitals.current_alerts.0"], "a");
		assert.equal(states["vitals.current_alerts.1"], "b");
	});

	it("publishes empty array as JSON string", async () => {
		const instance = createInstance();

		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ current_alerts: [] }, "vitals");

		assert.equal(states["vitals.current_alerts"], "[]");
	});

	it("publishes shrunk array correctly", async () => {
		const instance = createInstance();

		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ current_alerts: ["a", "b"] }, "vitals");
		assert.equal(states["vitals.current_alerts"], '["a","b"]');

		await instance.evalPoll({ current_alerts: ["a"] }, "vitals");
		assert.equal(states["vitals.current_alerts"], '["a"]');
	});

	it("cleans up stale children when array shrinks", async () => {
		const instance = createInstance();

		const existingObjects = new Map([["vitals.current_alerts.1", { type: "state" }]]);
		instance.getObjectAsync = async (key) => existingObjects.get(key) || null;

		const deleted = [];
		instance.delObjectAsync = async (key) => {
			deleted.push(key);
		};

		await instance.cleanupArrayChildren("vitals.current_alerts", 1);

		assert.ok(deleted.includes("vitals.current_alerts.1"));
	});

	it("handles cleanup after restart with stale children", async () => {
		const instance = createInstance();

		const existingObjects = new Map([
			["vitals.current_alerts.0", { type: "state" }],
			["vitals.current_alerts.1", { type: "state" }],
			["vitals.current_alerts.2", { type: "state" }],
		]);
		instance.getObjectAsync = async (key) => existingObjects.get(key) || null;

		const deleted = [];
		instance.delObjectAsync = async (key) => {
			deleted.push(key);
		};

		await instance.cleanupArrayChildren("vitals.current_alerts", 1);

		assert.ok(deleted.includes("vitals.current_alerts.1"));
		assert.ok(deleted.includes("vitals.current_alerts.2"));
		assert.ok(!deleted.includes("vitals.current_alerts.0"));
	});

	it("cleans up all children when array becomes empty", async () => {
		const instance = createInstance();

		const existingObjects = new Map([
			["vitals.current_alerts.0", { type: "state" }],
			["vitals.current_alerts.1", { type: "state" }],
		]);
		instance.getObjectAsync = async (key) => existingObjects.get(key) || null;

		const deleted = [];
		instance.delObjectAsync = async (key) => {
			deleted.push(key);
		};

		await instance.cleanupArrayChildren("vitals.current_alerts", 0);

		assert.ok(deleted.includes("vitals.current_alerts.0"));
		assert.ok(deleted.includes("vitals.current_alerts.1"));
	});

	it("handles numeric evse_not_ready_reasons", async () => {
		const instance = createInstance();

		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ evse_not_ready_reasons: [4, 8] }, "vitals");

		assert.equal(states["vitals.evse_not_ready_reasons"], "[4,8]");
		assert.equal(states["vitals.evse_not_ready_reasons.0"], 4);
		assert.equal(states["vitals.evse_not_ready_reasons.1"], 8);
	});
});

// ---------------------------------------------------------------------------
// ENDPOINT_MIN_INTERVALS
// ---------------------------------------------------------------------------
describe("ENDPOINT_MIN_INTERVALS", () => {
	it("vitals polls every cycle", () => {
		assert.equal(t.ENDPOINT_MIN_INTERVALS.vitals, 0);
	});

	it("lifetime polls every 60 seconds", () => {
		assert.equal(t.ENDPOINT_MIN_INTERVALS.lifetime, 60000);
	});

	it("wifi_status polls every 60 seconds", () => {
		assert.equal(t.ENDPOINT_MIN_INTERVALS.wifi_status, 60000);
	});

	it("version polls every hour", () => {
		assert.equal(t.ENDPOINT_MIN_INTERVALS.version, 3600000);
	});
});

// ---------------------------------------------------------------------------
// doDecode
// ---------------------------------------------------------------------------
describe("doDecode", () => {
	it("creates _Text state for translated values", async () => {
		const instance = createInstance();
		const states = {};
		instance.setStateChangedAsync = async () => {};
		instance.getObjectAsync = async () => null;
		instance.setObjectNotExistsAsync = async () => {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};

		await instance.doDecode("vitals.evse_state", 1);
		assert.ok("vitals.evse_state_Text" in states);
		assert.equal(typeof states["vitals.evse_state_Text"], "string");
	});

	it("skips _Text keys to prevent recursion", async () => {
		const instance = createInstance();
		let called = false;
		instance.doState = async () => {
			called = true;
		};

		await instance.doDecode("vitals.evse_state_Text", "Idle");
		assert.equal(called, false);
	});

	it("handles array-indexed state names", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};

		await instance.doDecode("vitals.evse_state.0", 1);
		assert.ok("vitals.evse_state.0_Text" in states);
	});

	it("does nothing for untranslated keys", async () => {
		const instance = createInstance();
		let called = false;
		instance.doState = async () => {
			called = true;
		};

		await instance.doDecode("vitals.grid_v", 230);
		assert.equal(called, false);
	});
});

// ---------------------------------------------------------------------------
// doState persistence error handling
// ---------------------------------------------------------------------------
describe("doState persistence errors", () => {
	it("logs and recovers from setObjectNotExistsAsync failure", async () => {
		const instance = createInstance();
		const errors = [];
		instance.log.error = (msg) => errors.push(msg);
		instance.getObjectAsync = async () => null;
		instance.setObjectNotExistsAsync = async () => {
			throw new Error("DB write failed");
		};

		await instance.doState("test.key", 42, "Test", "", false);
		assert.ok(errors.some((m) => m.includes("Persistence error") && m.includes("test.key")));
	});

	it("logs and recovers from setStateChangedAsync failure", async () => {
		const instance = createInstance();
		const errors = [];
		instance.log.error = (msg) => errors.push(msg);
		instance.getObjectAsync = async () => null;
		instance.setObjectNotExistsAsync = async () => {};
		instance.setStateChangedAsync = async () => {
			throw new Error("state write failed");
		};

		await instance.doState("test.key", 42, "Test", "", false);
		assert.ok(errors.some((m) => m.includes("Persistence error")));
	});

	it("does not propagate persistence error to caller", async () => {
		const instance = createInstance();
		instance.log.error = () => {};
		instance.getObjectAsync = async () => null;
		instance.setObjectNotExistsAsync = async () => {
			throw new Error("DB failed");
		};

		await instance.doState("test.key", 42, "Test", "", false);
	});

	it("persistence failure does not count as communication error", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.log.error = () => {};

		instance.getObjectAsync = async () => null;
		instance.setObjectNotExistsAsync = async () => {
			throw new Error("DB crash");
		};
		instance.setStateChangedAsync = async () => {
			throw new Error("DB crash");
		};

		instance.doGet = async (url) => {
			const ep = url.split("/").pop();
			if (ep === "vitals") return '{"evse_state": 1, "grid_v": 230}';
			if (ep === "lifetime") return '{"uptime_s": 1000, "energy_wh": 5000}';
			if (ep === "wifi_status") return '{"wifi_ssid": "test", "wifi_connected": true}';
			if (ep === "version") return '{"firmware_version": "1.0", "serial_number": "ABC"}';
			throw new Error("unknown");
		};
		instance.setNextPoll = () => ({});

		await instance.readTeslaWC3();
		assert.equal(instance.connected, true);
	});
});

// ---------------------------------------------------------------------------
// cleanupArrayChildren persistence errors
// ---------------------------------------------------------------------------
describe("cleanupArrayChildren persistence errors", () => {
	it("logs and stops on delObjectAsync failure", async () => {
		const instance = createInstance();
		const errors = [];
		instance.log.error = (msg) => errors.push(msg);
		instance.getObjectAsync = async () => ({ type: "state" });
		instance.delObjectAsync = async () => {
			throw new Error("delete failed");
		};

		await instance.cleanupArrayChildren("vitals.current_alerts", 0);
		assert.ok(errors.some((m) => m.includes("Persistence error")));
	});
});

// ---------------------------------------------------------------------------
// getSysLang
// ---------------------------------------------------------------------------
describe("getSysLang", () => {
	it("defaults to en on failure", async () => {
		const instance = createInstance();
		instance.getForeignObjectAsync = async () => {
			throw new Error("not available");
		};

		await instance.getSysLang();
		assert.equal(instance.langState, "en");
	});

	it("reads language from system config", async () => {
		const instance = createInstance();
		instance.getForeignObjectAsync = async () => ({
			common: { language: "de" },
		});

		await instance.getSysLang();
		assert.equal(instance.langState, "de");
	});
});

// ---------------------------------------------------------------------------
// calcPower bridge (adapter.calcPower → calcPowerValue)
// ---------------------------------------------------------------------------
describe("calcPower bridge", () => {
	it("creates vitals.power_w state from vitals data", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll(
			{
				evse_state: 1,
				grid_v: 230,
				voltageA_v: 230,
				currentA_a: 16,
				voltageB_v: 230,
				currentB_a: 16,
				voltageC_v: 230,
				currentC_a: 16,
			},
			"vitals",
		);

		assert.ok("vitals.power_w" in states);
		assert.equal(typeof states["vitals.power_w"], "number");
		assert.ok(Number(states["vitals.power_w"]) > 0);
	});

	it("does not create power_w for non-vitals endpoints", async () => {
		const instance = createInstance();
		const states = {};
		instance.doState = async (name, value) => {
			states[name] = value;
		};
		instance.cleanupArrayChildren = async () => {};

		await instance.evalPoll({ energy_wh: 5000, uptime_s: 1000 }, "lifetime");
		assert.ok(!("vitals.power_w" in states));
	});
});

// ---------------------------------------------------------------------------
// onReady
// ---------------------------------------------------------------------------
describe("onReady", () => {
	it("catches startup failures without unhandled rejection", async () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100" });
		const errors = [];
		instance.log.error = (msg) => errors.push(msg);
		instance.getForeignObjectAsync = async () => {
			throw new Error("system.config unavailable");
		};
		instance.getSysLang = async () => {
			throw new Error("injected failure");
		};

		await instance.onReady();
		assert.ok(errors.some((m) => m.includes("Unexpected startup failure")));
	});

	it("does not schedule polling after startup failure", async () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100" });
		instance.log.error = () => {};
		instance.getSysLang = async () => {
			throw new Error("injected");
		};

		let timerSet = false;
		instance.setNextPoll = () => {
			timerSet = true;
			return {};
		};

		instance.timer = { _fn: () => {}, _ms: 0 };
		await instance.onReady();
		assert.equal(timerSet, false);
		assert.equal(instance.timer, null);
	});

	it("sets connection=false after startup failure", async () => {
		const instance = createInstance({ teslawb3ip: "192.168.1.100" });
		instance.log.error = () => {};
		instance.getSysLang = async () => {
			throw new Error("injected");
		};

		const connStates = [];
		instance.setState = (id, val) => {
			if (id === "info.connection") connStates.push(val);
		};

		await instance.onReady();
		assert.equal(connStates[connStates.length - 1], false);
	});

	it("does not start polling when checkConfig fails", async () => {
		const instance = createInstance({ teslawb3ip: "" });

		let pollCalled = false;
		instance.readTeslaWC3 = async () => {
			pollCalled = true;
		};

		await instance.onReady();
		assert.equal(pollCalled, false);
	});
});

// ---------------------------------------------------------------------------
// EXPECTED_FIELDS
// ---------------------------------------------------------------------------
describe("EXPECTED_FIELDS", () => {
	it("has fields for all polled endpoints", () => {
		assert.ok(Array.isArray(t.EXPECTED_FIELDS.vitals));
		assert.ok(Array.isArray(t.EXPECTED_FIELDS.lifetime));
		assert.ok(Array.isArray(t.EXPECTED_FIELDS.wifi_status));
		assert.ok(Array.isArray(t.EXPECTED_FIELDS.version));
	});

	it("each field list is non-empty", () => {
		for (const [ep, fields] of Object.entries(t.EXPECTED_FIELDS)) {
			assert.ok(fields.length > 0, `${ep} should have at least one expected field`);
		}
	});

	it("rejects response missing all expected fields", () => {
		assert.throws(
			() => t.decodeTeslaResponse('{"unknown_field": 42}', "vitals"),
			/missing expected fields/,
		);
	});
});

// ---------------------------------------------------------------------------
// AbortController
// ---------------------------------------------------------------------------
describe("AbortController", () => {
	it("readTeslaWC3 creates a new AbortController each cycle", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		const controllers = [];
		const origReadTeslaWC3 = instance.readTeslaWC3.bind(instance);

		instance.doGet = async () => {
			controllers.push(instance.abortController);
			return '{"evse_state": 1, "grid_v": 230}';
		};
		instance.setNextPoll = () => ({});
		instance.evalPoll = async () => {};

		await instance.readTeslaWC3();
		const first = controllers[0];
		assert.ok(first instanceof AbortController);

		await instance.readTeslaWC3();
		assert.notEqual(controllers[controllers.length - 1], first);
	});

	it("onUnload aborts the controller", () => {
		const instance = createInstance();
		instance.abortController = new AbortController();
		const signal = instance.abortController.signal;

		instance.onUnload(() => {});

		assert.equal(signal.aborted, true);
		assert.equal(instance.abortController, null);
	});

	it("doGet suppresses logging during unload", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";
		instance.unloaded = true;

		const warnings = [];
		instance.log.warn = (msg) => warnings.push(msg);
		instance.http = {
			get: async () => {
				throw new Error("request failed");
			},
		};

		await assert.rejects(() => instance.doGet("http://x", 5000), /Adapter unloading/);
		assert.equal(warnings.length, 0);
	});

	it("per-endpoint catch returns immediately during unload", async () => {
		const instance = createInstance();
		instance.url = "http://192.168.1.100/api/1/";

		instance.doGet = async () => {
			instance.unloaded = true;
			throw new Error("canceled");
		};

		let timerSet = false;
		instance.setNextPoll = () => {
			timerSet = true;
			return {};
		};

		await instance.readTeslaWC3();
		assert.equal(timerSet, false);
		assert.equal(instance.connected, false);
	});
});

// ---------------------------------------------------------------------------
// maxRedirects
// ---------------------------------------------------------------------------
describe("maxRedirects", () => {
	it("axios instance has maxRedirects=0", () => {
		const instance = createInstance();
		assert.equal(instance.http.defaults.maxRedirects, 0);
	});
});
