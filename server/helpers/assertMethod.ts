import { BadMethodError } from "../errors/BadMethodError";

type HTTPMethod = "GET" | "POST" | "DELETE";

/**
 * Asserts that an HTTP method matches one expected.
 *
 * Note: Because Hono implicitly handles GET requests with HEAD,
 * we treat those methods as equivalent here.
 */
export function assertMethod<M extends HTTPMethod>(
	actual: string | undefined,
	expected: M
): asserts actual is M {
	// Hono implicitly handles HEAD with GET, so make sure to let that through:
	if (expected.toUpperCase() === "GET" && actual?.toUpperCase() === "HEAD") return;

	if (actual?.toUpperCase() !== expected.toUpperCase()) throw new BadMethodError();
}
