import type { Context, Input, MiddlewareHandler } from "hono";

declare global {
	type EnvKey =
		| "AUTH_SECRET"
		| "DATABASE_URL"
		| "HOST"
		| "MAX_BYTES"
		| "MAX_USERS"
		| "NODE_ENV"
		| "PUBNUB_PUBLISH_KEY"
		| "PUBNUB_SUBSCRIBE_KEY"
		| "PUBNUB_SECRET_KEY"
		| "VERCEL_URL";

	type Bindings = Record<EnvKey, string | undefined>;

	interface Env {
		Bindings?: Bindings;
		Variables?: Record<string, unknown>;
	}

	// eslint-disable-next-line @typescript-eslint/ban-types
	type APIRequestHandler<P extends string, I extends Input = {}> = (
		context: Context<Env, P, I>
	) => Response | Promise<Response>;

	// eslint-disable-next-line @typescript-eslint/ban-types
	type APIRequestMiddleware<P extends string, I extends Input = {}> = MiddlewareHandler<Env, P, I>;
}
