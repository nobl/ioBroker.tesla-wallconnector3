const state_trans = {
	"vitals.evse_state.de": {
		0: "Wallbox startet",
		1: "Idle",
		2: "Fahrzeug angeschlossen aber nicht bereit",
		3: "???",
		4: "Fahrzeug angeschlossen und bereit",
		5: "???",
		6: "Fahrzeug angeschlossen - Handshake läuft",
		7: "???",
		8: "Laden beendet / unterbrochen",
		9: "Bereit für laden - warte auf Fahrzeug",
		10: "Laden mit reduzierter Leistung (< 3 Phasen je 16 Ampere)",
		11: "Laden mit voller Leistung (3 Phasen je 16 Ampere)",
		12: "???",
	},
	"vitals.evse_state.en": {
		0: "booting",
		1: "idle",
		2: "connected but not ready",
		3: "???",
		4: "connected and ready",
		5: "???",
		6: "vehicle plugged in and handshaking",
		7: "???",
		8: "charging completed/interrupted",
		9: "ready for charging but waiting on car",
		10: "charging with reduced power (less than 3 phases, 16 amps each)",
		11: "charging full power (3 Phases, 16 amps each)",
		12: "???",
	},
};

module.exports = state_trans;
