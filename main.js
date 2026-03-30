"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const state_attr = require(`${__dirname}/lib/state_attr.js`);
const state_trans = require(`${__dirname}/lib/state_trans.js`);
const POLL_ENDPOINTS = ["version", "lifetime", "wifi_status", "vitals"];

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
		this.timer = null;
		this.http = axios.create();

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async onReady() {
		this.setState("info.connection", false, true);
		try {
			await this.getSysLang();
			await this.checkConfig();
			await this.checkConnection();
			await this.readTeslaWC3();
		} catch (error) {
			this.log.error(`Startup failed: ${error?.message || error}`);
			this.setState("info.connection", false, true);
		}
	}

	onUnload(callback) {
		try {
			this.unloaded = true;
			this.knownObjects.clear();
			if (this.timer) {
				clearTimeout(this.timer);
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

	async checkConfig() {
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

		if (!this.config.teslawb3ip) {
			throw new Error("Missing teslawb3ip in adapter config");
		}

		this.url = `http://${this.config.teslawb3ip}/api/1/`;
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

	async checkConnection() {
		this.log.info(`connecting to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
		await this.doGet(`${this.url}version`, this.config.pollingTimeout);
		this.log.info(`connected to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
		this.setState("info.connection", true, true);
	}

	/**
	 * Performs an HTTP GET request to the specified URL with a timeout.
	 *
	 * @param {string} pUrl - The URL to send the GET request to.
	 * @param {number} pollingTimeout - The timeout in milliseconds for the request.
	 * @returns {Promise<any>} The response data from the server.
	 */
	async doGet(pUrl, pollingTimeout) {
		try {
			const response = await this.http.get(pUrl, { timeout: pollingTimeout });
			this.log.debug(`(Poll) received data (${response.status}): ${JSON.stringify(response.data)}`);
			return response.data;
		} catch (error) {
			if (error.response) {
				this.log.warn(
					`(Poll) received error ${error.response.status} from Tesla Wall Connector Gen 3 with content: ${JSON.stringify(error.response.data)}`,
				);
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
			const results = await Promise.allSettled(
				POLL_ENDPOINTS.map(async (key) => {
					try {
						const obj = await this.doGet(this.url + key, this.config.pollingTimeout);
						return { key, obj };
					} catch (error) {
						throw new Error(`${key}: ${error?.message || error}`);
					}
				}),
			);

			let hasSuccess = false;
			let hasRejected = false;

			for (const result of results) {
				if (result.status === "fulfilled") {
					hasSuccess = true;
					const { key, obj } = result.value;
					await this.evalPoll(obj, key);
				} else {
					hasRejected = true;
					this.log.warn(`Polling endpoint failed: ${result.reason?.message || result.reason}`);
				}
			}

			if (!hasSuccess) {
				throw new Error("All polling endpoints failed");
			}

			if (hasRejected) {
				this.log.debug("Polling cycle completed with partial failures.");
			}

			if (this.retry > 0) {
				this.log.info(`Connection to Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}) restored.`);
			}
			this.retry = 0;
			this.setState("info.connection", true, true);

			if (this.unloaded) {
				return;
			}
			this.timer = this.setNextPoll(this.config.interval * 1000);
		} catch (error) {
			this.setState("info.connection", false, true);

			this.retry += 1;

			if (this.retry >= this.config.retries && this.config.retries < 999) {
				if (this.config.retries === 0) {
					this.log.error(
						`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). No retries configured. Continuing with normal polling interval. (${error?.message || error})`,
					);
				} else {
					this.log.error(
						`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). Retried ${this.retry} times. Switching back to normal polling interval. (${error?.message || error})`,
					);
				}

				this.retry = 0;

				if (!this.unloaded) {
					this.timer = this.setNextPoll(this.config.interval * 1000);
				}
				return;
			}

			const delayMs = this.config.interval * this.config.retrymultiplier * this.retry * 1000;
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
	 * @param {number} delayMs - the delay in milliseconds before the next poll is initiated, calculated based on the configured interval and retry logic
	 * @returns {NodeJS.Timeout} the timer object representing the scheduled poll, which can be used to clear the timeout if needed
	 */
	setNextPoll(delayMs) {
		if (this.timer) {
			clearTimeout(this.timer);
		}
		return setTimeout(() => void this.readTeslaWC3(), delayMs);
	}

	async doState(name, value, description, unit, write, read = true) {
		if (/^\d/.test(name)) {
			this.log.debug(`(doState) Invalid datapoint: ${name}: ${value}`);
			return;
		}

		this.log.silly(`(doState) Update: ${name}: ${value}`);
		const valueType = value === null ? "mixed" : typeof value;
		if (typeof value === "object" && value !== null) {
			this.log.debug(`(doState) Skipping non-primitive value for ${name}: ${JSON.stringify(value)}`);
			return;
		}

		let obj = this.knownObjects.get(name);
		if (!obj) {
			obj = await this.getObjectAsync(name);
			if (obj) {
				this.knownObjects.set(name, obj);
			}
		}

		if (obj) {
			obj.common = obj.common || {};
			const newCommon = {};
			if (obj.common.name !== description) {
				newCommon.name = description;
			}
			if (obj.common.type !== valueType) {
				newCommon.type = valueType;
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
				obj.common = { ...obj.common, ...newCommon };
				this.knownObjects.set(name, obj);
			}
		} else {
			obj = {
				type: "state",
				common: {
					name: description,
					type: valueType,
					role: this.guessRole(valueType, write),
					unit,
					read,
					write,
				},
				native: {},
			};
			await this.setObjectNotExistsAsync(name, obj);
			this.knownObjects.set(name, obj);
		}

		await this.setStateChangedAsync(name, { val: value, ack: true });
		await this.doDecode(name, value);
	}

	/**
	 * @param {string} valueType - the type of the value (e.g., "boolean", "number", "string") used to determine the appropriate role for the state
	 * @param {boolean} write switch or indicator role depending on whether the state is writable or not
	 * @returns {string} the guessed role for the state based on its type and writability, such as "switch" for writable booleans, "indicator" for read-only booleans, "value" for numbers, and "text" for other types
	 */
	guessRole(valueType, write) {
		if (valueType === "boolean") {
			return write ? "switch" : "indicator";
		}
		if (valueType === "number") {
			return "value";
		}
		return "text";
	}

	/**
	 * @param {string} name - the name of the state for which a translation is being attempted, used to look up translation tables and attributes to determine the appropriate translation for the value
	 * @param {string | number} value - the value of the state that may need to be translated, which can be a string or number and is used to look up the corresponding translation in the translation tables based on the current language and state attributes
	 * @returns {Promise<void>} a promise that resolves when the translation process is complete, which may involve creating or updating a corresponding "_Text" state with the translated value and description based on the original state name and attributes
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
	 * @param {{ [s: string]: any; } | ArrayLike<any>} obj - the object containing key-value pairs to be evaluated and processed, where each key represents a specific attribute or property of the Tesla Wall Connector Gen 3 and the corresponding value is the data associated with that attribute, which may require type conversion, unit assignment, and state creation or updating in the ioBroker system based on predefined state attributes and translation tables
	 * @param {string} key1 - the primary key or category under which the attributes in the object are organized, used to construct the full state names and look up corresponding attributes and translations for each key-value pair in the object, allowing for structured processing of the data received from the Tesla Wall Connector Gen 3 and proper integration into the ioBroker system
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
				for (let i = 0; i < value2.length; i++) {
					await this.doState(`${key}.${i}`, valueTyping(key, value2[i]), `${desc}[${i}]`, unit, false);
				}
			} else {
				await this.doState(key, valueTyping(key, value2), desc, unit, false);
			}
		}
	}
}

/**
 * modifies the supplied value based upon flags set for the specific key.
 *
 * @param {string} key - the key for which the value is being processed, used to look up attributes that determine how to process the value
 * @param {any} value - the value to be processed, can be of any type
 * @returns {any} value - the processed value, potentially converted to a different type or scaled based on attributes associated with the key
 */
function valueTyping(key, value) {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
			value = Number(trimmed);
		}
	} else if (typeof value === "number") {
		// keep numeric values as-is
	}

	if (state_attr[key] === undefined) {
		return value;
	}

	const isBool = !!state_attr[key]?.booltype;
	const multiply = state_attr[key]?.multiply ?? 1;

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
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options] options
	 */

	module.exports = (options) => new TeslaWallconnector3(options);
} else {
	new TeslaWallconnector3();
}
