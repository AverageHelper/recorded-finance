import { t } from "../i18n";
import atob from "atob-lite";

export function dataUriToBlob(dataUri: string): Blob {
	// See https://stackoverflow.com/a/12300351

	// convert base64 to raw binary data held in a string
	// doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
	const encodedByteString = dataUri.split(",")[1];
	if (encodedByteString === undefined)
		throw new TypeError(t("error.fs.invalid-uri-no-byte-string"));
	const byteString = atob(encodedByteString);

	// separate out the mime component
	const type = dataUri.split(",")[0]?.split(":")[1]?.split(";")[0];
	if (type === undefined) throw new TypeError(t("error.fs.invalid-uri-no-mime-string"));

	// write the bytes of the string to an ArrayBuffer
	const ab = new ArrayBuffer(byteString.length);

	// create a view into the buffer
	const ia = new Uint8Array(ab);

	// set the bytes of the buffer to the correct values
	for (let i = 0; i < byteString.length; i += 1) {
		ia[i] = byteString.charCodeAt(i);
	}

	// write the ArrayBuffer to a blob, and you're done
	return new Blob([ab], { type });
}

async function dataFromBlob(file: Blob, type: "dataUrl" | "text"): Promise<string> {
	return await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener("load", () => {
			const result = reader.result;
			if (typeof result === "string") {
				resolve(result);
			} else {
				reject(new TypeError(t("error.fs.expected-string", { values: { type: typeof result } })));
			}
		});
		reader.addEventListener("error", error => {
			reject(error);
		});
		switch (type) {
			case "dataUrl":
				reader.readAsDataURL(file);
				break;
			case "text":
				reader.readAsText(file);
				break;
		}
	});
}

export async function dataUrlFromFile(file: Blob): Promise<string> {
	return await dataFromBlob(file, "dataUrl");
}

export async function getJsonFromFile(file: Blob): Promise<unknown> {
	const text = await dataFromBlob(file, "text");
	return JSON.parse(text) as unknown;
}

// These are different, I promise
export function downloadFileAtUrl(url: string, filename: string): void {
	const anchor = document.createElement("a");
	anchor.href = url; // file to download
	anchor.download = filename; // filename to save as
	anchor.click();
}
