import type { RawDecryptionError } from "./RawDecryptionError";
import { t } from "../../i18n";

export class DecryptionError extends Error {
	/**
	 * Constructs a new `DecryptionError` instance using a message
	 * derived from the given {@link RawDecryptionError} object.
	 */
	constructor(raw: Pick<RawDecryptionError, "message" | "values">) {
		super(t(raw.message, { values: raw.values }));
		this.name = "DecryptionError";
	}
}
