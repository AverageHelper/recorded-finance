import type {
	RequestHandler,
	Request as ExpressRequest,
	Response as ExpressResponse,
	NextFunction,
} from "express";

type AsyncRequestHandler = (
	req: ExpressRequest,
	res: ExpressResponse,
	next: NextFunction
) => void | Promise<void>;

/**
 * Wraps an asynchronous request handler in a normal Express handler.
 *
 * @param fn The asynchronous request handler to call.
 * @returns a request handler that passes thrown errors to `next`
 */
export const asyncWrapper = (fn: AsyncRequestHandler): RequestHandler => {
	// Don't sneeze on this, it works
	return function asyncUtilWrap(req, res, next): void {
		const fnReturn = fn(req, res, next);
		// eslint-disable-next-line promise/prefer-await-to-then, promise/no-callback-in-promise
		Promise.resolve(fnReturn).catch(next);
	};
};
