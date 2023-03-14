import type { UID } from "../database";
import { NotFoundError } from "../errors/NotFoundError";

/**
 * Express and Vercel keep query path params in the `params` and `query`
 * fields, respectively.
 *
 * See https://vercel.com/docs/concepts/functions/serverless-functions#path-segments
 */
export function pathSegments<K extends string>(
	req: APIRequest,
	...keys: ReadonlyArray<K>
): Record<K, string> & { uid?: UID } {
	const result: Partial<Record<K, string>> = {};

	for (const key of new Set(keys)) {
		const query =
			"params" in req
				? req.params[key] // Express
				: req.query[key]; // Vercel
		if (query === undefined || query === "") throw new NotFoundError();
		if (Array.isArray(query)) throw new NotFoundError();
		result[key] = query;
	}

	return result as Record<K, string>;
}
