"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const state_attr = require(`${__dirname}/lib/state_attr.js`);
const state_trans = require(`${__dirname}/lib/state_trans.js`);

const POLL_ENDPOINTS = ["version", "lifetime", "wifi_status", "vitals"];

// Defensive upper bound for scanning stale numeric child states during array cleanup.
// Prevents unbounded iteration if the object tree has unexpected content.
const ARRAY_CHILD_CLEANUP_LIMIT = 100;

// Cap on retry backoff delay to prevent indefinite wait times.
const MAX_RETRY_DELAY_MS = 3600000; // 1 hour

const ENDPOINT_MIN_INTERVALS = {
	vitals: 0,
	lifetime: 60000,
	wifi_status: 60000,
	version: 3600000,
};

const EXPECTED_FIELDS = {
	vitals: ["evse_state", "grid_v"],
	lifetime: ["uptime_s", "energy_wh"],
	wifi_status: ["wifi_ssid", "wifi_connected"],
	version: ["firmware_version", "serial_number"],
};

class TeslaWallconnector3 extends utils.Adapter {
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options] options
	 */
	constructor(options) {
		// @ts-expect-error Allow spreading user-supplied options into Adapter constructor despite type mismatch
		super({
			...options,
			name: "tesla-wallconnector3",
		});

		this.knownObjects = new Map();
		this.retry = 0;
		this.langState = "en";
		this.url = "";
		this.unloaded = false;
		this.connected = false;
		this.timer = null;
		this.lastFetch = {};
		this.abortController = null;
		this.http = axios.create({ maxContentLength: 2 * 1024 * 1024, maxRedirects: 0, proxy: false });

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async onReady() {
		this.setState("info.connection", false, true);
		try {
			await this.getSysLang();
			if (!this.checkConfig()) {
				return;
			}
			this.log.info(`connecting to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
			await this.readTeslaWC3();
		} catch (error) {
			this.log.error(`Unexpected startup failure: ${error?.message || error}`);
			if (this.timer) {
				this.clearTimeout(this.timer);
				this.timer = null;
			}
			this.setState("info.connection", false, true);
		}
	}

	/**
	 * @param {() => void} callback - adapter unload callback
	 */
	onUnload(callback) {
		try {
			this.unloaded = true;
			this.connected = false;
			if (this.abortController) {
				this.abortController.abort();
				this.abortController = null;
			}
			this.knownObjects.clear();
			if (this.timer) {
				this.clearTimeout(this.timer);
				this.timer = null;
			}
			this.setState("info.connection", false, true);
			this.log.info("cleaned everything up...");
			callback();
		} catch (e) {
			this.log.error(e);
			callback();
		}
	}

	/**
	 * Validates and normalizes adapter configuration.
	 *
	 * @returns {boolean} true if configuration is valid and polling should start
	 */
	checkConfig() {
		this.config.interval = Number(this.config.interval);
		this.config.pollingTimeout = Number(this.config.pollingTimeout);
		this.config.retries = Number(this.config.retries);
		this.config.retrymultiplier = Number(this.config.retrymultiplier);
		this.config.teslawb3ip = String(this.config.teslawb3ip || "").trim();

		this.log.debug(`Configured polling interval: ${this.config.interval}`);
		if (!Number.isFinite(this.config.interval) || this.config.interval < 1 || this.config.interval > 3600) {
			this.log.warn(`Config interval ${this.config.interval} not in [1..3600]. Using default: 10`);
			this.config.interval = 10;
		}

		this.log.debug(`Configured polling timeout: ${this.config.pollingTimeout}`);
		if (
			!Number.isFinite(this.config.pollingTimeout) ||
			this.config.pollingTimeout < 1000 ||
			this.config.pollingTimeout > 10000
		) {
			this.log.warn(`Config timeout ${this.config.pollingTimeout} not in [1000..10000] ms. Using default: 5000`);
			this.config.pollingTimeout = 5000;
		}

		this.log.debug(`Configured retries: ${this.config.retries}`);
		if (!Number.isInteger(this.config.retries) || this.config.retries < 0 || this.config.retries > 999) {
			this.log.warn(`Config retries ${this.config.retries} not in [0..999]. Using default: 10`);
			this.config.retries = 10;
		}

		this.log.debug(`Configured retry multiplier: ${this.config.retrymultiplier}`);
		if (
			!Number.isFinite(this.config.retrymultiplier) ||
			this.config.retrymultiplier < 1 ||
			this.config.retrymultiplier > 10
		) {
			this.log.warn(`Config retry multiplier ${this.config.retrymultiplier} not in [1..10]. Using default: 2`);
			this.config.retrymultiplier = 2;
		}

		const validatedHost = validateHost(this.config.teslawb3ip);
		if (!validatedHost) {
			if (!this.config.teslawb3ip || this.config.teslawb3ip === "0.0.0.0") {
				this.log.warn(
					"Tesla Wall Connector Gen 3 IP address is not configured. Please set the IP or FQDN in the adapter settings.",
				);
			} else {
				this.log.warn(
					`Tesla Wall Connector Gen 3 host "${this.config.teslawb3ip}" is invalid. Use an IP address or hostname without scheme, port, or path.`,
				);
			}
			return false;
		}

		this.url = `http://${validatedHost}/api/1/`;
		return true;
	}

	async getSysLang() {
		try {
			const ret = await this.getForeignObjectAsync("system.config");
			this.langState = ret?.common?.language || "en";
		} catch {
			this.log.error("(getSysLang) Reverting to default language (en).");
			this.langState = "en";
		}
		this.log.debug(`Language: ${this.langState}`);
	}

	/**
	 * Performs an HTTP GET request and returns the raw response text.
	 *
	 * @param {string} pUrl - The URL to send the GET request to.
	 * @param {number} pollingTimeout - The timeout in milliseconds for the request.
	 * @returns {Promise<string>} The raw response text from the server.
	 */
	async doGet(pUrl, pollingTimeout) {
		try {
			const response = await this.http.get(pUrl, {
				timeout: pollingTimeout,
				responseType: "text",
				signal: this.abortController?.signal,
			});
			this.log.debug(`(Poll) received data (${response.status})`);
			return response.data;
		} catch (error) {
			if (this.unloaded) {
				throw new Error("Adapter unloading");
			}
			if (error.response) {
				this.log.warn(`(Poll) received error ${error.response.status} from Tesla Wall Connector Gen 3`);
				throw new Error(`HTTP ${error.response.status}`);
			}
			if (error.request) {
				this.log.warn(error.message);
				throw new Error(error.message);
			}
			this.log.warn(error.message);
			throw new Error(error.message || "Unknown request error");
		}
	}

	async readTeslaWC3() {
		try {
			this.abortController = new AbortController();
			const now = Date.now();
			const isReconnect = this.retry > 0 || !this.connected;

			const endpointsToPoll = POLL_ENDPOINTS.filter((ep) => {
				const minInterval = ENDPOINT_MIN_INTERVALS[ep];
				const lastSuccess = this.lastFetch[ep] || 0;
				if (isReconnect && ep === "version") {
					return true;
				}
				return now - lastSuccess >= minInterval;
			});

			if (endpointsToPoll.length === 0) {
				if (!this.unloaded) {
					this.timer = this.setNextPoll(this.config.interval * 1000);
				}
				return;
			}

			let hasSuccess = false;
			let hasRejected = false;
			let vitalsSuccess = false;

			for (const key of endpointsToPoll) {
				if (this.unloaded) {
					return;
				}

				try {
					const rawText = await this.doGet(this.url + key, this.config.pollingTimeout);
					const obj = decodeTeslaResponse(rawText, key);
					await this.evalPoll(obj, key);
					hasSuccess = true;
					if (key === "vitals") {
						vitalsSuccess = true;
					}
					this.lastFetch[key] = Date.now();
				} catch (error) {
					if (this.unloaded) {
						return;
					}
					hasRejected = true;
					this.log.warn(`Polling endpoint failed: ${key}: ${error?.message || error}`);
				}
			}

			if (this.unloaded) {
				return;
			}

			if (!hasSuccess) {
				throw new Error("All polling endpoints failed");
			}

			if (hasRejected) {
				this.log.debug("Polling cycle completed with partial failures.");
			}

			if (this.unloaded) {
				return;
			}

			if (vitalsSuccess) {
				if (this.retry > 0) {
					this.log.info(`Connection to Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}) restored.`);
				} else if (!this.connected) {
					this.log.info(`connected to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
				}
				this.connected = true;
				this.retry = 0;
				this.setState("info.connection", true, true);
			} else if (this.connected) {
				this.connected = false;
				this.setState("info.connection", false, true);
			}

			if (this.unloaded) {
				return;
			}
			this.timer = this.setNextPoll(this.config.interval * 1000);
		} catch (error) {
			if (this.unloaded) {
				return;
			}

			if (this.connected) {
				this.lastFetch = {};
			}
			this.connected = false;
			this.setState("info.connection", false, true);

			this.retry += 1;

			if (this.retry > this.config.retries && this.config.retries < 999) {
				if (this.config.retries === 0) {
					this.log.warn(
						`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). No retries configured. Continuing with normal polling interval. (${error?.message || error})`,
					);
				} else {
					this.log.error(
						`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). Retried ${this.retry - 1} times. Switching back to normal polling interval. (${error?.message || error})`,
					);
				}

				this.retry = 0;

				if (!this.unloaded) {
					this.timer = this.setNextPoll(this.config.interval * 1000);
				}
				return;
			}

			const delayMs = Math.min(
				this.config.interval * this.config.retrymultiplier * this.retry * 1000,
				MAX_RETRY_DELAY_MS,
			);
			this.log.warn(
				`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). Retry ${this.retry}/${this.config.retries} in ${Math.round(delayMs / 1000)} seconds! (${error?.message || error})`,
			);
			if (!this.unloaded) {
				this.timer = this.setNextPoll(delayMs);
			}
		}
	}

	/**
	 * Schedules the next polling cycle.
	 *
	 * @param {number} delayMs - the delay in milliseconds before the next poll is initiated
	 * @returns {ioBroker.Timeout | undefined} the timer object
	 */
	setNextPoll(delayMs) {
		if (this.timer) {
			this.clearTimeout(this.timer);
		}
		return this.setTimeout(() => void this.readTeslaWC3(), delayMs);
	}

	/**
	 * @param {string} name - the state name
	 * @param {any} value - the state value
	 * @param {string} description - the state description
	 * @param {string} unit - the unit
	 * @param {boolean} write - whether the state is writable
	 * @param {boolean} [read] - whether the state is readable
	 */
	async doState(name, value, description, unit, write, read = true) {
		if (this.unloaded) {
			return;
		}

		if (/^\d/.test(name)) {
			this.log.debug(`(doState) Invalid datapoint: ${name}: ${value}`);
			return;
		}

		this.log.silly(`(doState) Update: ${name}: ${value}`);
		if (typeof value === "object" && value !== null) {
			this.log.debug(`(doState) Skipping non-primitive value for ${name}: ${JSON.stringify(value)}`);
			return;
		}

		try {
			let obj = this.knownObjects.get(name);
			if (!obj) {
				obj = await this.getObjectAsync(name);
				if (this.unloaded) {
					return;
				}
				if (obj) {
					this.knownObjects.set(name, obj);
				}
			}

			const valueType = value === null ? obj?.common?.type || "mixed" : typeof value;
			const role = state_attr[name]?.role || guessRole(valueType, write);

			if (obj) {
				obj.common = obj.common || {};
				const newCommon = {};
				if (obj.common.name !== description) {
					newCommon.name = description;
				}
				if (obj.common.type !== valueType) {
					newCommon.type = valueType;
				}
				if (obj.common.role !== role) {
					newCommon.role = role;
				}
				if (obj.common.unit !== unit) {
					newCommon.unit = unit;
				}
				if (obj.common.write !== write) {
					newCommon.write = write;
				}
				if (obj.common.read !== read) {
					newCommon.read = read;
				}

				if (Object.keys(newCommon).length > 0) {
					await this.extendObject(name, { common: newCommon });
					if (this.unloaded) {
						return;
					}
					obj.common = { ...obj.common, ...newCommon };
					this.knownObjects.set(name, obj);
				}
			} else {
				obj = {
					type: "state",
					common: {
						name: description,
						type: valueType,
						role,
						unit,
						read,
						write,
					},
					native: {},
				};
				await this.setObjectNotExistsAsync(name, obj);
				if (this.unloaded) {
					return;
				}
				this.knownObjects.set(name, obj);
			}

			await this.setStateChangedAsync(name, { val: value, ack: true });
		} catch (error) {
			this.log.error(`Persistence error for ${name}: ${error?.message || error}`);
			return;
		}

		if (this.unloaded) {
			return;
		}
		await this.doDecode(name, value);
	}

	/**
	 * @param {string} name - the state name
	 * @param {string | number} value - the state value
	 */
	async doDecode(name, value) {
		if (name.endsWith("_Text")) {
			return;
		}

		let key = name;
		const lastSegment = name.substring(name.lastIndexOf(".") + 1);
		if (/^\d+$/.test(lastSegment)) {
			key = name.substring(0, name.lastIndexOf("."));
		}

		for (const lang of [...new Set([this.langState, "en"])]) {
			const translationTable = state_trans[`${key}.${lang}`];
			if (!translationTable) {
				continue;
			}

			const trans = translationTable[value] !== undefined ? translationTable[value] : "(unknown)";
			const desc = state_attr[`${key}_Text`] !== undefined ? state_attr[`${key}_Text`].name : key;
			await this.doState(`${name}_Text`, trans, desc, "", false);
			return;
		}
	}

	/**
	 * @param {{ [s: string]: any; } | ArrayLike<any>} obj - the parsed endpoint response
	 * @param {string} key1 - the endpoint name
	 */
	async evalPoll(obj, key1) {
		if (this.unloaded) {
			return;
		}

		if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
			this.log.warn(`Unexpected response for ${key1}: ${JSON.stringify(obj)}`);
			return;
		}

		for (const [key2, value2] of Object.entries(obj)) {
			if (this.unloaded) {
				return;
			}

			if (value2 === "VARIABLE_NOT_FOUND" || key2 === "OBJECT_NOT_FOUND") {
				continue;
			}

			const key = `${key1}.${key2}`;
			if (state_attr[key] === undefined) {
				this.log.debug(`REPORT_TO_DEV: State attribute definition missing for: ${key}, Val: ${value2}`);
			}

			const desc = state_attr[key]?.name || key2;
			const unit = state_attr[key]?.unit || "";

			if (value2 && typeof value2 === "object" && !Array.isArray(value2)) {
				this.log.debug(`Skipping nested object for state ${key}: ${JSON.stringify(value2)}`);
				continue;
			}

			if (Array.isArray(value2)) {
				await this.doState(key, JSON.stringify(value2), desc, unit, false);
				for (let i = 0; i < value2.length; i++) {
					await this.doState(`${key}.${i}`, valueTyping(key, value2[i]), `${desc}[${i}]`, unit, false);
				}
				await this.cleanupArrayChildren(key, value2.length);
			} else if (key === "wifi_status.wifi_ssid") {
				await this.doState(key, value2, desc, unit, false);
			} else {
				await this.doState(key, valueTyping(key, value2), desc, unit, false);
			}
		}

		if (key1 === "vitals") {
			await this.calcPower(obj);
		}
	}

	/**
	 * Removes stale numeric child states when an array shrinks.
	 *
	 * @param {string} key - the parent state key
	 * @param {number} currentLength - the current array length
	 */
	async cleanupArrayChildren(key, currentLength) {
		let i = currentLength;
		while (i < currentLength + ARRAY_CHILD_CLEANUP_LIMIT) {
			if (this.unloaded) {
				return;
			}
			try {
				const obj = await this.getObjectAsync(`${key}.${i}`);
				if (!obj) {
					break;
				}
				await this.delObjectAsync(`${key}.${i}`);
				this.knownObjects.delete(`${key}.${i}`);
				try {
					const textObj = await this.getObjectAsync(`${key}.${i}_Text`);
					if (textObj) {
						await this.delObjectAsync(`${key}.${i}_Text`);
						this.knownObjects.delete(`${key}.${i}_Text`);
					}
				} catch {
					// text cleanup is best-effort
				}
			} catch (error) {
				this.log.error(`Persistence error during cleanup of ${key}.${i}: ${error?.message || error}`);
				break;
			}
			i++;
		}
	}

	/**
	 * Calculates and publishes charging power from vitals data.
	 *
	 * @param {{ [s: string]: any }} obj - the vitals response object
	 */
	async calcPower(obj) {
		const power = calcPowerValue(obj, !!this.config.splitPhase);
		const attr = state_attr["vitals.power_w"];
		await this.doState(
			"vitals.power_w",
			power,
			attr?.name || "Charging Power (calculated)",
			attr?.unit || "W",
			false,
		);
	}
}

/**
 * Parses and validates a Tesla Wall Connector API response.
 *
 * @param {string} rawText - the raw response body
 * @param {string} endpoint - the endpoint name for error messages
 * @returns {object} the parsed and validated response object
 */
function decodeTeslaResponse(rawText, endpoint) {
	if (typeof rawText !== "string") {
		throw new Error(`${endpoint}: response is not a string`);
	}

	const trimmed = rawText.trim();
	if (!trimmed) {
		throw new Error(`${endpoint}: empty response body`);
	}

	if (trimmed[0] !== "{" && trimmed[0] !== "[") {
		throw new Error(`${endpoint}: response is not JSON`);
	}

	let parsed;

	try {
		parsed = JSON.parse(trimmed);
	} catch {
		const nanFixed = repairBareNan(trimmed);
		try {
			parsed = JSON.parse(nanFixed);
		} catch {
			if (canRepairMissingBrace(trimmed)) {
				try {
					parsed = JSON.parse(`${trimmed}}`);
				} catch {
					// fall through
				}
			}
			if (!parsed && canRepairMissingBrace(nanFixed)) {
				try {
					parsed = JSON.parse(`${nanFixed}}`);
				} catch {
					// fall through
				}
			}
			if (!parsed) {
				throw new Error(`${endpoint}: unparseable response`);
			}
		}
	}

	if (parsed === null) {
		throw new Error(`${endpoint}: response is null`);
	}

	if (Array.isArray(parsed)) {
		throw new Error(`${endpoint}: response is an array`);
	}

	if (typeof parsed !== "object") {
		throw new Error(`${endpoint}: response is not an object`);
	}

	if (Object.keys(parsed).length === 0) {
		throw new Error(`${endpoint}: response is an empty object`);
	}

	const expectedFields = EXPECTED_FIELDS[endpoint];
	if (expectedFields) {
		const hasExpected = expectedFields.some((f) => f in parsed);
		if (!hasExpected) {
			throw new Error(`${endpoint}: response missing expected fields`);
		}
	}

	return parsed;
}

/**
 * Replaces bare non-finite tokens (nan, Infinity, -Infinity, +Infinity) with null,
 * only outside JSON strings and only in value positions (after : , or [).
 * All matching is case-insensitive.
 *
 * @param {string} text - the raw JSON-like text
 * @returns {string} the text with bare non-finite tokens replaced by null
 */
function repairBareNan(text) {
	const len = text.length;
	let result = "";
	let inString = false;
	let i = 0;

	while (i < len) {
		if (inString) {
			if (text[i] === "\\") {
				result += text.substring(i, i + 2);
				i += 2;
				continue;
			}
			if (text[i] === '"') {
				inString = false;
			}
			result += text[i];
			i++;
			continue;
		}

		if (text[i] === '"') {
			inString = true;
			result += text[i];
			i++;
			continue;
		}

		if (
			i + 2 < len &&
			(text[i] === "n" || text[i] === "N") &&
			(text[i + 1] === "a" || text[i + 1] === "A") &&
			(text[i + 2] === "n" || text[i + 2] === "N")
		) {
			let p = i - 1;
			while (p >= 0 && " \t\n\r".includes(text[p])) {
				p--;
			}
			const prev = p >= 0 ? text[p] : "";

			const next = i + 3 < len ? text[i + 3] : "";

			if ((prev === ":" || prev === "," || prev === "[") && (next === "" || ",}] \t\n\r".includes(next))) {
				result += "null";
				i += 3;
				continue;
			}
		}

		if (
			(text[i] === "I" || text[i] === "i") &&
			i + 8 <= len &&
			text.substring(i, i + 8).toLowerCase() === "infinity"
		) {
			let p = i - 1;
			while (p >= 0 && " \t\n\r".includes(text[p])) {
				p--;
			}
			const prev = p >= 0 ? text[p] : "";
			const next = i + 8 < len ? text[i + 8] : "";
			if ((prev === ":" || prev === "," || prev === "[") && (next === "" || ",}] \t\n\r".includes(next))) {
				result += "null";
				i += 8;
				continue;
			}
		}

		if (
			(text[i] === "-" || text[i] === "+") &&
			i + 9 <= len &&
			text.substring(i + 1, i + 9).toLowerCase() === "infinity"
		) {
			let p = i - 1;
			while (p >= 0 && " \t\n\r".includes(text[p])) {
				p--;
			}
			const prev = p >= 0 ? text[p] : "";
			const next = i + 9 < len ? text[i + 9] : "";
			if ((prev === ":" || prev === "," || prev === "[") && (next === "" || ",}] \t\n\r".includes(next))) {
				result += "null";
				i += 9;
				continue;
			}
		}

		if (
			(text[i] === "-" || text[i] === "+") &&
			i + 4 <= len &&
			(text[i + 1] === "n" || text[i + 1] === "N") &&
			(text[i + 2] === "a" || text[i + 2] === "A") &&
			(text[i + 3] === "n" || text[i + 3] === "N")
		) {
			let p = i - 1;
			while (p >= 0 && " \t\n\r".includes(text[p])) {
				p--;
			}
			const prev = p >= 0 ? text[p] : "";
			const next = i + 4 < len ? text[i + 4] : "";
			if ((prev === ":" || prev === "," || prev === "[") && (next === "" || ",}] \t\n\r".includes(next))) {
				result += "null";
				i += 4;
				continue;
			}
		}

		result += text[i];
		i++;
	}

	return result;
}

/**
 * Checks whether appending a single closing brace could repair the text.
 * Returns true only when exactly one object brace is unmatched, all brackets
 * are balanced, and all strings are closed.
 *
 * @param {string} text - the raw JSON-like text
 * @returns {boolean} true if a single missing brace repair is plausible
 */
function canRepairMissingBrace(text) {
	let braceDepth = 0;
	let bracketDepth = 0;
	let inString = false;

	for (let i = 0; i < text.length; i++) {
		if (inString) {
			if (text[i] === "\\") {
				i++;
				continue;
			}
			if (text[i] === '"') {
				inString = false;
			}
			continue;
		}

		switch (text[i]) {
			case '"':
				inString = true;
				break;
			case "{":
				braceDepth++;
				break;
			case "}":
				braceDepth--;
				break;
			case "[":
				bracketDepth++;
				break;
			case "]":
				bracketDepth--;
				break;
		}
	}

	return !inString && braceDepth === 1 && bracketDepth === 0;
}

/**
 * Validates and normalizes a wallbox host string.
 * Rejects schemes, credentials, paths, queries, fragments, ports, and
 * bracketed IPv6 literals. Returns the trimmed host on success, null on failure.
 *
 * @param {string} host - the raw host configuration value
 * @returns {string | null} the validated host or null
 */
function validateHost(host) {
	if (typeof host !== "string") {
		return null;
	}
	const trimmed = host.trim();
	if (!trimmed || trimmed === "0.0.0.0") {
		return null;
	}
	if (trimmed.length > 253) {
		return null;
	}
	if (/[\s:@/?#[\]]/.test(trimmed)) {
		return null;
	}

	const labels = trimmed.split(".");
	for (const label of labels) {
		if (!label || label.length > 63) {
			return null;
		}
		if (!/^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/.test(label)) {
			return null;
		}
	}

	return trimmed;
}

/**
 * Calculates charging power from vitals data.
 *
 * @param {{ [s: string]: any }} obj - the vitals response
 * @param {boolean} splitPhase - true for North American split-phase calculation
 * @returns {number} the calculated power in watts, or 0 if insufficient data
 */
function calcPowerValue(obj, splitPhase) {
	if (splitPhase) {
		const gridV = Number(obj.grid_v);
		const vehicleCurrent = Number(obj.vehicle_current_a);
		if (!Number.isFinite(gridV) || !Number.isFinite(vehicleCurrent)) {
			return 0;
		}
		return parseFloat((gridV * vehicleCurrent).toFixed(1));
	}

	const phases = [
		[obj.voltageA_v, obj.currentA_a],
		[obj.voltageB_v, obj.currentB_a],
		[obj.voltageC_v, obj.currentC_a],
	];

	let power = 0;
	let hasCompletePhase = false;

	for (const [voltage, current] of phases) {
		const vPresent = voltage !== undefined && voltage !== null;
		const cPresent = current !== undefined && current !== null;

		if (!vPresent && !cPresent) {
			continue;
		}
		if (!vPresent || !cPresent) {
			return 0;
		}

		const v = Number(voltage);
		const c = Number(current);
		if (!Number.isFinite(v) || !Number.isFinite(c)) {
			return 0;
		}

		hasCompletePhase = true;
		power += v * c;
	}

	if (!hasCompletePhase) {
		return 0;
	}
	return parseFloat(power.toFixed(1));
}

/**
 * @param {string} valueType - the type of the value
 * @param {boolean} write - whether the state is writable
 * @returns {string} the guessed role for the state
 */
function guessRole(valueType, write) {
	if (valueType === "boolean") {
		return write ? "switch" : "indicator";
	}
	if (valueType === "number") {
		return "value";
	}
	return "text";
}

/**
 * Converts a value based on type flags in state_attr for the given key.
 *
 * @param {string} key - the state key
 * @param {any} value - the raw value
 * @returns {any} the typed value
 */
function valueTyping(key, value) {
	if (value === null) {
		const attr = state_attr[key];
		if (attr?.booltype) {
			return false;
		}
		if (attr?.unit || (attr?.role && attr.role.startsWith("value."))) {
			return 0;
		}
		return value;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed !== "") {
			const num = Number(trimmed);
			if (Number.isFinite(num)) {
				value = num;
			}
		}
	}

	if (state_attr[key] === undefined) {
		return value;
	}

	return applyTyping(value, state_attr[key]);
}

/**
 * Applies booltype conversion and multiply factor from state attribute metadata.
 *
 * @param {any} value - the value to process
 * @param {object} attr - the state attribute metadata
 * @returns {any} the processed value
 */
function applyTyping(value, attr) {
	const isBool = !!attr?.booltype;
	const multiply = attr?.multiply ?? 1;

	if (isBool) {
		if (typeof value === "boolean") {
			return value;
		}
		if (typeof value === "number") {
			return value !== 0;
		}
		if (typeof value === "string") {
			const normalized = value.trim().toLowerCase();
			if (normalized === "true" || normalized === "1") {
				return true;
			}
			if (normalized === "false" || normalized === "0" || normalized === "") {
				return false;
			}
		}
		return Boolean(value);
	}

	if (multiply !== 1 && typeof value === "number") {
		return parseFloat((value * multiply).toFixed(2));
	}

	return value;
}

if (require.main !== module) {
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options] options
	 */

	module.exports = (options) => new TeslaWallconnector3(options);
	module.exports._testing = {
		valueTyping,
		applyTyping,
		guessRole,
		calcPowerValue,
		decodeTeslaResponse,
		repairBareNan,
		canRepairMissingBrace,
		validateHost,
		ENDPOINT_MIN_INTERVALS,
		EXPECTED_FIELDS,
		ARRAY_CHILD_CLEANUP_LIMIT,
		MAX_RETRY_DELAY_MS,
	};
} else {
	new TeslaWallconnector3();
}
