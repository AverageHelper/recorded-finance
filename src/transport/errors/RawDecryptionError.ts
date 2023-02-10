// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DecryptionError } from "./DecryptionError";

/**
 * An error thrown during decryption. Construct a {@link DecryptionError}
 * for error messages in the user's own language.
 */
export class RawDecryptionError extends Error {
	readonly values: Record<string, string> | undefined;

	private constructor(message: string, values?: Record<string, string>) {
		super(message);
		this.values = values;
		this.name = "RawDecryptionError";
	}

	static resultIsEmpty(): RawDecryptionError {
		return new RawDecryptionError("error.cryption.empty-result");
	}

	static parseFailed(error: unknown, plaintext: string): RawDecryptionError {
		let message: string;
		if (error instanceof Error) {
			message = error.message;
		} else {
			message = JSON.stringify(error);
		}
		return new RawDecryptionError("error.cryption.plaintext-not-json", {
			error: message,
			plaintext,
		});
	}

	static malformedKey(): RawDecryptionError {
		return new RawDecryptionError("error.cryption.malformed-key");
	}
}

export function isProbablyRawDecryptionError(tbd: unknown): tbd is RawDecryptionError {
	// Can't use `instanceof` directly, because this value might have been deserialized from a different context
	return tbd instanceof Error && tbd.name === "RawDecryptionError";
}
