import type { ErrorRequestHandler } from "express";
import { InternalError, respondError, respondInternalError } from "./responses.js";

export const handleErrors: ErrorRequestHandler = (err: unknown, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}
	if (err instanceof InternalError) {
		if (!err.harmless) console.error(err);
		return respondError(res, err);
	}
	console.error(err);
	return respondInternalError(res);
};
