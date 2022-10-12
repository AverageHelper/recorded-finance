import type { DocumentData } from "./database";
import { InternalError } from "./errors";

// See https://stackoverflow.com/a/54337073 for why "Vary: *" is necessary for Safari
const VARY = ["Vary", "*"] as const;
const CACHE_CONTROL = ["Cache-Control", "no-store"] as const;

export function respondSuccess(
	res: APIResponse,
	additionalValues?: Record<string, string | number | null | Array<string | number>>
): void {
	res
		.setHeader(...CACHE_CONTROL) //
		.setHeader(...VARY)
		.json({ ...additionalValues, message: "Success!" });
}

export function respondData<T extends { _id: string } | { uid: string }>(
	res: APIResponse,
	data: DocumentData<T> | Array<DocumentData<T>> | null
): void {
	res
		.setHeader(...CACHE_CONTROL)
		.setHeader(...VARY)
		.json({ message: "Success!", data });
}

export function respondError(res: APIResponse, err: InternalError): void {
	res.setHeader(...CACHE_CONTROL);
	res.setHeader(...VARY);
	err.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	res.status(err.status).json({ message: err.message, code: err.code });
}

export function respondInternalError(res: APIResponse): void {
	respondError(res, new InternalError());
}
