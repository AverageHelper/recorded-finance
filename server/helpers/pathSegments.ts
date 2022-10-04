import { NotFoundError } from "../errors";

/**
 * Express and Vercel keep query path params in the `params` and `query`
 * fields, respectively.
 *
 * See https://vercel.com/docs/concepts/functions/serverless-functions#path-segments
 */
export function pathSegments<K extends string>(
	req: APIRequest,
	...keys: Array<K>
): Record<K, string> {
	const result: Partial<Record<K, string>> = {};

	for (const key of new Set(keys)) {
		const query =
			"params" in req
				? req.params[key] // Express
				: req.query[key]; // Vercel
		if (query === undefined) throw new NotFoundError();
		if (Array.isArray(query)) throw new NotFoundError();
		result[key] = query;
	}

	return result as Record<K, string>;
}
