"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const state_attr = require(`${__dirname}/lib/state_attr.js`);
const state_trans = require(`${__dirname}/lib/state_trans.js`);

let retry = 0; // retry-counter
let langState = "en";
let url = "";
let unloaded = false;
const cache = {};

class TeslaWallconnector3 extends utils.Adapter {
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options] some options
	 */
	constructor(options) {
		super({
			...options,
			name: "tesla-wallconnector3",
		});

		this.knownObjects = new Map();

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);
		try {
			await this.getSysLang();
			await this.checkConfig();
			await this.checkConnection();
			await this.readTeslaWC3();
		} catch (error) {
			this.log.error(error);
			this.setState("info.connection", false, true);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param {() => void} callback The shutdown callback
	 */
	onUnload(callback) {
		try {
			this.knownObjects.clear(); // empty objects cache
			unloaded = true;
			if (this.timer) {
				clearTimeout(this.timer);
			}
			this.log.info("cleaned everything up...");
			this.setState("info.connection", false, true);
			callback();
		} catch (e) {
			callback(e);
		}
	}

	/**
	 * checks config paramaters
	 * Fallback to default values in case they are out of scope
	 */
	async checkConfig() {
		this.log.debug(`(checkConf) Configured polling interval high priority: ${this.config.interval}`);
		if (this.config.interval < 1 || this.config.interval > 3600) {
			this.log.warn(
				`(checkConf) Config interval ${this.config.interval} not [1..3600] seconds. Using default: 10`,
			);
			this.config.interval = 10;
		}
		this.log.debug(`(checkConf) Configured polling timeout: ${this.config.pollingTimeout}`);
		if (this.config.pollingTimeout < 1000 || this.config.pollingTimeout > 10000) {
			this.log.warn(
				`(checkConf) Config timeout ${this.config.pollingTimeout} not [1000..10000] ms. Using default: 5000`,
			);
			this.config.pollingTimeout = 5000;
		}
		this.log.debug(`(checkConf) Configured num of retries: ${this.config.retries}`);
		if (this.config.retries < 0 || this.config.retries > 999) {
			this.log.warn(
				`(checkConf) Config num of retries ${this.config.retries} not [0..999] seconds. Using default: 10`,
			);
			this.config.retries = 10;
		}
		this.log.debug(`(checkConf) Configured retry multiplier: ${this.config.retrymultiplier}`);
		if (this.config.retrymultiplier < 1 || this.config.retrymultiplier > 10) {
			this.log.warn(
				`(checkConf) Config retry multiplier ${
					this.config.retrymultiplier
				} not [1..10] seconds. Using default: 2`,
			);
			this.config.retrymultiplier = 2;
		}
		this.log.debug(`(checkConf) WallBox-IP: ${this.config.teslawb3ip}`);
		url = `http://${this.config.teslawb3ip}/api/1/`;
	}

	/**
	 * Reads system language
	 * Fallback to en if not available
	 */
	async getSysLang() {
		try {
			const ret = await this.getForeignObjectAsync("system.config");
			langState = ret && ret.common && ret.common.language ? ret.common.language : "en";
		} catch {
			this.log.error("(getSysLang) Reverting to default language (en).");
			langState = "en";
		}
		this.log.debug(`Language: ${langState}`);
	}

	/**
	 * checks connection to Tesla Wall Connector Gen 3 service
	 */
	async checkConnection() {
		try {
			this.log.info(`connecting to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
			await this.doGet(`${url}version`, this, this.config.pollingTimeout);
			this.log.info(`connected to Tesla Wall Connector Gen 3: ${this.config.teslawb3ip}`);
			this.setState("info.connection", true, true);
		} catch (error) {
			throw new Error(
				`Error connecting to Tesla Wall Connector Gen 3 (IP: ${this.config.teslawb3ip}). Exiting! (${error})`,
			);
		}
	}

	/**
	 * Read from url via axios
	 *
	 * @param {string} pUrl - The URL to read from
	 * @param {object} caller - The caller object
	 * @param {number} pollingTimeout - The timeout for the polling request in milliseconds
	 */
	doGet(pUrl, caller, pollingTimeout) {
		return new Promise(function (resolve, reject) {
			axios({
				method: "get",
				url: pUrl,
				timeout: pollingTimeout,
			})
				.then(async (response) => {
					const content = response.data;
					caller.log.debug(`(Poll) received data (${response.status}): ${JSON.stringify(content)}`);
					resolve(JSON.stringify(content));
				})
				.catch((error) => {
					if (error.response) {
						// The request was made and the server responded with a status code
						caller.log.warn(
							`(Poll) received error ${
								error.response.status
							} response from Tesla Wall Connector Gen 3 with content: ${JSON.stringify(
								error.response.data,
							)}`,
						);
						reject(error.response.status);
					} else if (error.request) {
						// The request was made but no response was received
						// `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js<div></div>
						caller.log.info(error.message);
						reject(error.message);
					} else {
						// Something happened in setting up the request that triggered an Error
						caller.log.info(error.message);
						reject(error.status);
					}
				});
		});
	}

	/**
	 * Read values from Tesla Wall Connector Gen 3
	 */
	async readTeslaWC3() {
		const keys = ["version", "lifetime", "wifi_status", "vitals"];
		try {
			for (const key of keys) {
				const body = await this.doGet(url + key, this, this.config.pollingTimeout);
				const obj = JSON.parse(body);
				await this.evalPoll(obj, key);
			}
			retry = 0;
			if (unloaded) {
				return;
			}
			this.timer = setTimeout(() => this.readTeslaWC3(), this.config.interval * 1000);
		} catch (error) {
			if (retry == this.config.retries && this.config.retries < 999) {
				this.log.error(
					`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). Retried ${
						retry
					} times. Giving up now. Check config and restart adapter. (${error})`,
				);
				this.setState("info.connection", false, true);
			} else {
				retry += 1;
				this.log.warn(
					`Error reading from Tesla Wall Connector Gen 3 (${this.config.teslawb3ip}). Retry ${retry}/${
						this.config.retries
					} in ${this.config.interval * this.config.retrymultiplier * retry} seconds! (${error})`,
				);
				this.timer = setTimeout(
					() => this.readTeslaWC3(),
					this.config.interval * this.config.retrymultiplier * retry * 1000,
				);
			}
		}
	}

	/**
	 * sets a state's value and creates the state if it doesn't exist yet
	 *
	 * @param name Name of the state
	 * @param value Value of the state
	 * @param description Description of the state
	 * @param unit Unit of the state
	 * @param write Writable state
	 * @param read Readable state
	 */
	async doState(name, value, description, unit, write, read = true) {
		if (!isNaN(name.substring(0, 1))) {
			// keys cannot start with digits! Possibly SENEC delivering erraneous data
			this.log.debug(`(doState) Invalid datapoint: ${name}: ${value}`);
			return;
		}
		this.log.silly(`(doState) Update: ${name}: ${value}`);

		const valueType = value !== null && value !== undefined ? typeof value : "mixed";

		// Check object for changes:
		let obj = this.knownObjects.get(name);
		if (!obj) {
			obj = await this.getObjectAsync(name);

			if (obj) {
				this.knownObjects.set(name, obj);
			}
		}
		if (obj) {
			const newCommon = {};
			if (obj.common.name !== description) {
				this.log.debug(`(doState) Updating object: ${name} (desc): ${obj.common.name} -> ${description}`);
				newCommon.name = description;
			}
			if (obj.common.type !== valueType) {
				this.log.debug(`(doState) Updating object: ${name} (type): ${obj.common.type} -> ${valueType}`);
				newCommon.type = valueType;
			}
			if (obj.common.unit !== unit) {
				this.log.debug(`(doState) Updating object: ${name} (unit): ${obj.common.unit} -> ${unit}`);
				newCommon.unit = unit;
			}
			if (obj.common.write !== write) {
				this.log.debug(`(doState) Updating object: ${name} (write): ${obj.common.write} -> ${write}`);
				newCommon.write = write;
			}
			if (obj.common.read !== read) {
				this.log.debug(`(doState) Updating object: ${name} (read): ${obj.common.read} -> ${read}`);
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
					role: "value",
					unit: unit,
					read: read,
					write: write,
				},
				native: {},
			};

			await this.setObjectNotExistsAsync(name, obj);
			this.knownObjects.set(name, obj);
		}
		await this.setStateChangedAsync(name, {
			val: value,
			ack: true,
		});
		await this.doDecode(name, value);
	}

	/**
	 * Checks if there is decoding possible for a given value and creates/updates a decoded state
	 * Language used for translations is the language of the SENEC appliance
	 *
	 * @param name Name of State
	 * @param value Value of State
	 */
	async doDecode(name, value) {
		if (name.endsWith("_Text")) {
			return;
		}
		let key = name;
		if (!isNaN(name.substring(name.lastIndexOf(".")) + 1)) {
			key = name.substring(0, name.lastIndexOf("."));
		}
		this.log.silly(`(Decode) Checking: ${name} -> ${key}`);

		for (const lang of [langState, "en"]) {
			if (state_trans[`${key}.${lang}`] !== undefined) {
				// checking given language
				this.log.silly(`(Decode) Trans found for: ${key}.${lang}`);
				const trans =
					state_trans[`${key}.${lang}`] !== undefined
						? state_trans[`${key}.${lang}`][value] !== undefined
							? state_trans[`${key}.${lang}`][value]
							: "(unknown)"
						: "(unknown)";
				this.log.silly(`(Decode) Trans ${key}:${value} = ${trans}`);
				const desc = state_attr[`${key}_Text`] !== undefined ? state_attr[`${key}_Text`].name : key;
				await this.doState(`${name}_Text`, trans, desc, "", true);
				return; // bail out once we did this once
			}
		}
	}

	/**
	 * evaluates data polled from SENEC system.
	 * creates / updates the state.
	 *
	 * @param {{ [s: string]: any; } | ArrayLike<any>} obj object to evaluate
	 * @param {string} key1 key for state
	 */
	async evalPoll(obj, key1) {
		if (unloaded) {
			return;
		}
		for (const [key2, value2] of Object.entries(obj)) {
			if (value2 !== "VARIABLE_NOT_FOUND" && key2 !== "OBJECT_NOT_FOUND") {
				const key = `${key1}.${key2}`;
				if (state_attr[key] === undefined) {
					this.log.info(`REPORT_TO_DEV: State attribute definition missing for: ${key}, Val: ${value2}`);
				}
				const desc = state_attr[key] !== undefined ? state_attr[key].name : key2;
				const unit = state_attr[key] !== undefined ? state_attr[key].unit : "";

				if (Array.isArray(value2)) {
					for (let i = 0; i < value2.length; i++) {
						this.doState(`${key}.${i}`, ValueTyping(key, value2[i]), `${desc}[${i}]`, unit, false);
					}
				} else {
					this.doState(key, ValueTyping(key, value2), desc, unit, false);
				}
			}
		}
	}

	cacheCheck(key) {
		const entry = cache[key];
		if (entry) {
			this.log.debug(`Cache hit: ${key}`);
			return true;
		}
		return false;
	}

	cacheGet(key) {
		const entry = cache[key];
		if (entry) {
			this.log.debug(`Cache read: ${key}[${JSON.stringify(entry)}]`);
			return entry;
		}
		return null;
	}

	cachePut(key, value, description, type, unit, write) {
		this.log.debug(`Cache put: ${key}[${value}, ${description}, ${type}, ${unit}, ${write}]`);
		cache[key] = {
			value: value,
			description: description,
			type: type,
			unit: unit,
			write: write,
		};
	}

	cachePutObj(key, obj) {
		this.log.debug(`Cache put obj: ${key}[${JSON.stringify(obj)}]`);
		cache[key] = obj;
	}

	cacheUpdateValue(key, value) {
		this.log.debug(`Cache update: ${key}[${value}]`);
		const entry = this.cacheGet(key);
		entry.value = value;
		cache[key] = entry;
		this.log.debug(`Cache write: ${key}[${JSON.stringify(entry)}]`);
	}
}

/**
 * modifies the supplied value based upon flags set for the specific key.
 * currently handles bool, date, ip objects
 *
 * @param key key to check
 * @param value value to modify
 */
const ValueTyping = (key, value) => {
	if (!isNaN(value)) {
		value = Number(value);
	} // otherwise iobroker will note it as string
	if (state_attr[key] === undefined) {
		return value;
	}
	const isBool = state_attr[key] !== undefined && state_attr[key].booltype ? state_attr[key].booltype : false;
	const multiply = state_attr[key] !== undefined && state_attr[key].multiply ? state_attr[key].multiply : 1;
	if (isBool) {
		return value === 0 ? false : true;
	} else if (multiply !== 1) {
		return parseFloat((value * multiply).toFixed(2));
	}
	return value;
};

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options] options
	 */
	module.exports = (options) => new TeslaWallconnector3(options);
} else {
	// otherwise start the instance directly
	new TeslaWallconnector3();
}
