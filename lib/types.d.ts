// Shared types referenced from the JSDoc annotations in main.js.
//
// These live in a .d.ts rather than as JSDoc @typedef blocks because the ioBroker
// eslint config reports @typedef/@property as redundant when a type system is available.

declare global {
	/**
	 * A value as it arrives from a wallbox JSON response: either a primitive that can be
	 * written to a state, or a nested object or array that is stringified or skipped.
	 */
	type RawValue = ioBroker.StateValue | object;

	/** Metadata for a single state, as defined in lib/state_attr.js. */
	interface StateAttr {
		/** Human-readable name for the state. */
		name: string;
		/** ioBroker role, guessed from the value type when omitted. */
		role?: string;
		/** Unit of measurement. */
		unit?: string;
		/** The value is a boolean (0/1 becomes false/true). */
		booltype?: boolean;
		/** Factor the raw value is multiplied by. */
		multiply?: number;
	}
}

// Required so the declarations above are treated as global augmentations
export {};
