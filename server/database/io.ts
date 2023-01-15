import type { Prisma } from "@prisma/client";
import type { URL } from "node:url";
import { logger } from "../logger";
import { PrismaClient } from "@prisma/client";

const dataSources = new Map<URL | "default", DatabaseClient>();

const logOptions = [
	{
		level: "query",
		emit: "event",
	},
	{
		level: "info",
		emit: "event",
	},
	{
		level: "warn",
		emit: "event",
	},
	{
		level: "error",
		emit: "event",
	},
] as const;

/**
 * Returns a new Prisma data source using the default config in the prisma/schema.prisma file.
 *
 * @param databaseUrl The database connection URL. Defaults to the URL given in the schema file.
 */
export function dataSource(databaseUrl?: URL): PrismaClient {
	let source = dataSources.get(databaseUrl ?? "default");
	if (source) return source;

	// Start connecting to the database
	source = new PrismaClient({
		datasources: databaseUrl
			? // Override the configured data source URL, use the given URL instead:
			  {
					db: {
						url: databaseUrl.href,
					},
			  }
			: // Use the configured URL by default:
			  undefined,
		log: [...logOptions],
	});

	logger.debug("Connected to database");

	// Log database accesses
	source.$use(async (params, next) => {
		const before = Date.now();
		const result: unknown = await next(params);
		const after = Date.now();
		logger.debug(`Query ${params.model ?? "undefined"}.${params.action} took ${after - before}ms`);
		return result;
	});

	function logMessageForEvent(event: Prisma.LogEvent): string {
		const { target, timestamp, message } = event;
		return `[${target}, ${timestamp.toUTCString()}] ${message}`;
	}

	source.$on("error", event => {
		logger.error(logMessageForEvent(event));
	});

	source.$on("warn", event => {
		logger.warn(logMessageForEvent(event));
	});

	source.$on("info", event => {
		logger.info(logMessageForEvent(event));
	});

	source.$on("query", event => {
		logger.debug(`Target: ${event.target}`);
		logger.debug(`Query: ${event.query}`);
		logger.debug(`Timestamp: ${event.timestamp.toUTCString()}`);
		logger.debug(`Duration: ${event.duration}ms`);

		try {
			// Prisma logs query params in an array (usually)
			const params = JSON.parse(event.params) as unknown;
			if (!Array.isArray(params))
				throw new TypeError(`Params were found not to be an array. Instead got ${typeof params}`);

			// Describe each value vaguely
			const cleanParams = params.map((value: unknown) => {
				if (typeof value === "string") {
					return `<${value.length}-len string>`;
				}
				return `<${typeof value}>`;
			});
			logger.debug(`Params: [${cleanParams.join(",")}]`);
		} catch (error) {
			// Don't force it if we cannot log the params. We'll fix it later.
			logger.error("Could not parse params:", error);
		}
	});

	// Remember this client for later
	dataSources.set(databaseUrl ?? "default", source);

	return source;
}

/**
 * Infers the log levels defined in the given array.
 */
type LevelsFromLogDefinitions<A extends ReadonlyArray<Prisma.LogDefinition>> =
	A extends ReadonlyArray<{ level: infer L }> ? L : never;

/**
 * Strips the `readonly` modifier from the given object.
 */
declare type Mutable<T extends object> = {
	-readonly [K in keyof T]: T[K];
};

/**
 * A Prisma client with appropriate logging event types.
 */
type DatabaseClient = PrismaClient<
	{ log: Mutable<typeof logOptions> },
	LevelsFromLogDefinitions<typeof logOptions>,
	false
>;
