import type { RateLimiterRes } from "rate-limiter-flexible";
import { HttpStatusCode } from "@/helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class ThrottledError extends InternalError {
	constructor(rateLimiterRes: RateLimiterRes) {
		const headers = new Map<string, string | number | ReadonlyArray<string>>([
			["Retry-After", rateLimiterRes.msBeforeNext / 1000],
		]);
		super({
			status: HttpStatusCode.TOO_MANY_REQUESTS,
			code: "too-many-requests",
			message: "You are being throttled",
			headers,
		});
		this.name = "ThrottledError";
	}
}
