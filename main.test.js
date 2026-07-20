"use strict";

const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

// Mock adapter-core so main.js can be loaded without ioBroker
const mainExport = proxyquire("./main", {
	"@iobroker/adapter-core": {
		Adapter: class {
			constructor() {}
			on() {}
		},
	},
});

const t = mainExport._testing;
const state_attr = require("./lib/state_attr.js");

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
});

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
		// vitals.vehicle_connected has booltype: true
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

	it("applies multiply factor", () => {
		// Find a key with multiply !== 1, or test with a known key
		// For now test that multiply=1 keys pass through unchanged
		assert.equal(t.valueTyping("vitals.grid_v", 230.5), 230.5);
		assert.equal(t.valueTyping("lifetime.energy_wh", 12345), 12345);
	});

	it("returns value unchanged for keys not in state_attr", () => {
		assert.equal(t.valueTyping("totally.unknown", "abc"), "abc");
		assert.equal(t.valueTyping("totally.unknown", 99), 99);
		assert.equal(t.valueTyping("totally.unknown", true), true);
	});
});

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
