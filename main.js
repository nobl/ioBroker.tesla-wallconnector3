"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const state_attr = require(__dirname + "/lib/state_attr.js");
const state_trans = require(__dirname + "/lib/state_trans.js");

let retry = 0; // retry-counter
let langState = "";
let url = "";


class TeslaWallconnector3 extends utils.Adapter {

	/**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
	constructor(options) {
		super({
			...options,
			name: "tesla-wallconnector3",
		});
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
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.timer) clearTimeout(this.timer);
			this.log.info("cleaned everything up...");
			this.setState("info.connection", false, true);
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * checks config paramaters
	 * Fallback to default values in case they are out of scope
	 */
	async checkConfig() {
		this.log.debug("(checkConf) Configured polling interval high priority: " + this.config.interval);
		if (this.config.interval < 1 || this.config.interval > 3600) {
			this.log.warn("(checkConf) Config interval " + this.config.interval + " not [1..3600] seconds. Using default: 10");
			this.config.interval = 10;
		}
		this.log.debug("(checkConf) Configured polling timeout: " + this.config.pollingTimeout);
		if (this.config.pollingTimeout < 1000 || this.config.pollingTimeout > 10000) {
			this.log.warn("(checkConf) Config timeout " + this.config.pollingTimeout + " not [1000..10000] ms. Using default: 5000");
			this.config.pollingTimeout = 5000;
		}
		this.log.debug("(checkConf) Configured num of retries: " + this.config.retries);
		if (this.config.retries < 0 || this.config.retries > 999) {
			this.log.warn("(checkConf) Config num of retries " + this.config.retries + " not [0..999] seconds. Using default: 10");
			this.config.retries = 10;
		}
		this.log.debug("(checkConf) Configured retry multiplier: " + this.config.retrymultiplier);
		if (this.config.retrymultiplier < 1 || this.config.retrymultiplier > 10) {
			this.log.warn("(checkConf) Config retry multiplier " + this.config.retrymultiplier + " not [1..10] seconds. Using default: 2");
			this.config.retrymultiplier = 2;
		}

		url = "http://" + this.config.teslawb3ip + "/api/1/";

		this.getForeignObject("system.config", (err, state) => {
			langState = state.common.language;
			this.log.debug("Language set: " + langState);
		});
	}

	/**
	 * checks connection to Tesla Wall Connector Gen 3 service
	 */
	async checkConnection() {
		try {
			this.log.info("connecting to Tesla Wall Connector Gen 3: " + this.config.teslawb3ip);
			await this.doGet(url + "version", this, this.config.pollingTimeout);
			this.log.info("connected to Tesla Wall Connector Gen 3: " + this.config.teslawb3ip);
			this.setState("info.connection", true, true);
		} catch (error) {
			throw new Error("Error connecting to Tesla Wall Connector Gen 3 (IP: " + this.config.teslawb3ip + "). Exiting! (" + error + ")");
		}
	}

	/**
	 * Read from url via axios
	 * @param url to read from
	 */
	async doGet(pUrl, caller, pollingTimeout) {
		return new Promise(function (resolve, reject) {
			axios({
				method: "get",
				url: pUrl,
				timeout: pollingTimeout
			})
				.then(
					async (response) => {
						const content = response.data;
						caller.log.debug("(Poll) received data (" + response.status + "): " + JSON.stringify(content));
						resolve(JSON.stringify(content));
					}
				)
				.catch(
					(error) => {
						if (error.response) {
							// The request was made and the server responded with a status code
							caller.log.warn("(Poll) received error " + error.response.status + " response from Tesla Wall Connector Gen 3 with content: " + JSON.stringify(error.response.data));
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
					}
				);
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
			this.timer = setTimeout(() => this.readTeslaWC3(), this.config.interval * 1000);
		} catch (error) {
			if ((retry == this.config.retries) && this.config.retries < 999) {
				this.log.error("Error reading from Tesla Wall Connector Gen 3 (" + this.config.teslawb3ip + "). Retried " + retry + " times. Giving up now. Check config and restart adapter. (" + error + ")");
				this.setState("info.connection", false, true);
			} else {
				retry += 1;
				this.log.warn("Error reading from Tesla Wall Connector Gen 3 (" + this.config.teslawb3ip + "). Retry " + retry + "/" + this.config.retries + " in " + this.config.interval * this.config.retrymultiplier * retry + " seconds! (" + error + ")");
				this.timer = setTimeout(() => this.readTeslaWC3(), this.config.interval * this.config.retrymultiplier * retry * 1000);
			}
		}
	}


	/**
	 * sets a state's value and creates the state if it doesn't exist yet
	 */
	async doState(name, value, description, unit, write) {
		if (!isNaN(name.substring(0, 1))) {
			// keys cannot start with digits! Possibly erraneous data
			this.log.debug("(doState) Invalid datapoint: " + name + ": " + value);
			return;
		}
		this.log.silly("(doState) Update: " + name + ": " + value);
		await this.setObjectNotExistsAsync(name, {
			type: "state",
			common: {
				name: description,
				type: typeof(value),
				role: "value",
				unit: unit,
				read: true,
				write: write
			},
			native: {}
		});

		// Check object for changes:
		const obj = await this.getObjectAsync(name);
		if (obj.common.name != description) {
			this.log.debug("(doState) Updating object: " + name + " (desc): " + obj.common.name + " -> " + description);
			await this.extendObject(name, {common: {name: description}});
		}
		if (obj.common.type != typeof(value)) {
			this.log.debug("(doState) Updating object: " + name + " (type): " + obj.common.type + " -> " + typeof(value));
			await this.extendObject(name, {common: {type: typeof(value)}});
		}
		if (obj.common.unit != unit) {
			this.log.debug("(doState) Updating object: " + name + " (unit): " + obj.common.unit + " -> " + unit);
			await this.extendObject(name, {common: {unit: unit}});
		}
		if (obj.common.write != write) {
			this.log.debug("(doState) Updating object: " + name + " (write): " + obj.common.write + " -> " + write);
			await this.extendObject(name, {common: {write: write}});
		}

		const oldState = await this.getStateAsync(name);
		if (oldState) {
			if (oldState.val === value) return;
			this.log.debug("(doState) Update: " + name + ": " + oldState.val + " -> " + value);
		}
		await this.setStateAsync(name, {
			val: value,
			ack: true
		});
		await this.doDecode(name, value);
	}

	/**
	 * Checks if there is decoding possible for a given value and creates/updates a decoded state
	 */
	async doDecode(name, value) {
		if (name.endsWith("_Text")) return;
		let key = name;
		if (!isNaN(name.substring(name.lastIndexOf(".")) + 1)) key = name.substring(0, name.lastIndexOf("."));
		this.log.silly("(Decode) Checking: " + name + " -> " + key);

		for (const lang of [langState, "en"]) {
			if (state_trans[key + "." + lang] !== undefined) { // checking given language
				this.log.silly("(Decode) Trans found for: " + key + "." + lang);
				const trans = (state_trans[key + "." + lang] !== undefined ? (state_trans[key + "." + lang][value] !== undefined ? state_trans[key + "." + lang][value] : "(unknown)") : "(unknown)");
				this.log.silly("(Decode) Trans " + key + ":" + value + " = " + trans);
				const desc = (state_attr[key + "_Text"] !== undefined) ? state_attr[key + "_Text"].name : key;
				await this.doState(name + "_Text", trans, desc, "", true);
				return; // bail out once we did this once
			}
		}
	}

	/**
	 * evaluates data polled from system.
	 * creates / updates the state.
	 */
	async evalPoll(obj, key1) {
		for (const[key2, value2] of Object.entries(obj)) {
			if (value2 !== "VARIABLE_NOT_FOUND" && key2 !== "OBJECT_NOT_FOUND") {
				const key = key1 + "." + key2;
				if (state_attr[key] === undefined) {
					this.log.info("REPORT_TO_DEV: State attribute definition missing for: " + key + ", Val: " + value2);
				}
				const desc = (state_attr[key] !== undefined) ? state_attr[key].name : key2;
				const unit = (state_attr[key] !== undefined) ? state_attr[key].unit : "";

				if (Array.isArray(value2)) {
					for (let i = 0; i < value2.length; i++) {
						this.doState(key + "." + i, ValueTyping(key, value2[i]), desc + "[" + i + "]", unit, false);
					}
				} else {
					this.doState(key, ValueTyping(key, value2), desc, unit, false);
				}
			}
		}
	}

}

/**
 * modifies the supplied value based upon flags set for the specific key.
 * currently handles bool, objects
 */
const ValueTyping = (key, value) => {
	if (!isNaN(value)) value = Number(value); // otherwise iobroker will note it as string
	if (state_attr[key] === undefined) {
		return value;
	}
	const isBool = (state_attr[key] !== undefined && state_attr[key].booltype) ? state_attr[key].booltype : false;
	const multiply = (state_attr[key] !== undefined && state_attr[key].multiply) ? state_attr[key].multiply : 1;
	if (isBool) {
		return (value === 0) ? false : true;
	} else if (multiply !== 1) {
		return (value *= multiply).toFixed(2);
	} else {
		return value;
	}
};

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new TeslaWallconnector3(options);
} else {
	// otherwise start the instance directly
	new TeslaWallconnector3();
}
