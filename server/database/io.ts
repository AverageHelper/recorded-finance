import type { Prisma } from "@prisma/client";
import { logger } from "../logger";
import { PrismaClient } from "@prisma/client";

// Start connecting to the database
export const dataSource = new PrismaClient({
	log: [
		{
			emit: "event",
			level: "query",
		},
		{
			emit: "event",
			level: "info",
		},
		{
			emit: "event",
			level: "warn",
		},
		{
			emit: "event",
			level: "error",
		},
	],
});
logger.debug("Connected to database");

// Log database accesses
dataSource.$use(async (params, next) => {
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

dataSource.$on("error", event => {
	logger.error(logMessageForEvent(event));
});

dataSource.$on("warn", event => {
	logger.warn(logMessageForEvent(event));
});

dataSource.$on("info", event => {
	logger.info(logMessageForEvent(event));
});

dataSource.$on("query", event => {
	logger.debug(`Target: ${event.target}`);
	logger.debug(`Query: ${event.query}`);
	logger.debug(`Timestamp: ${event.timestamp.toUTCString()}`);
	logger.debug(`Params: ${event.params}`);
	logger.debug(`Duration: ${event.duration}ms`);
});
