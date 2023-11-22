import { BadRequestError } from "../errors/BadRequestError";
import { env } from "../environment";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { ThrottledError } from "../errors/ThrottledError";

/**
 * // TODO: Better throttling
 * The first is number of consecutive failed attempts by the same user name and IP address.
 *
 * The second is number of failed attempts from an IP address over some long period of time. * or example, block an IP address if it makes 100 failed attempts in one day.
 */

const points = 10; // 10 tries
const duration = 10 * 60; // per 10 minutes
const blockDuration = 10 * 60; // block for 10 mins after points run out

// FIXME: We shouldn't use RateLimiterMemory in production, especially on Cloudflare
const rateLimiter = new RateLimiterMemory({ points, duration, blockDuration });

/**
 * Middleware that prevents an IP address from sending more than
 * 10 requests in 10 minutes.
 */
export const throttle: APIRequestMiddleware<"*"> = async function throttle(c, next) {
	if (env(c, "NODE_ENV") === "test") {
		// Test mode. Skip throttle
		await next();
		return;
	}

	// Works on Vercel, but not Node
	const remoteIp = c.req.header("x-forwarded-for"); // Use 'CF-Connecting-IP’ in Cloudflare
	if (!remoteIp) throw new BadRequestError("Missing 'X-Forwarded-For' header.");

	try {
		await rateLimiter.consume(remoteIp);
		await next();
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			throw new ThrottledError(error);
		}
		throw error;
	}
};
