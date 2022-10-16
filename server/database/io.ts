import { PrismaClient } from "@prisma/client";

// Start connecting to the database
export const dataSource = new PrismaClient();
console.debug("Connected to database");

// Log database accesses
dataSource.$use(async (params, next) => {
	const before = Date.now();
	const result: unknown = await next(params);
	const after = Date.now();
	console.debug(`Query ${params.model ?? "undefined"}.${params.action} took ${after - before}ms`);
	return result;
});
