import { BadMethodError } from "@/errors/BadMethodError";

type HTTPMethod = "GET" | "POST" | "DELETE";

export function assertMethod<M extends HTTPMethod>(
	actual: string | undefined,
	expected: M
): asserts actual is M {
	if (actual !== expected) throw new BadMethodError();
}
