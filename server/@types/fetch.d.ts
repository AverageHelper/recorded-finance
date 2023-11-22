/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types, @typescript-eslint/consistent-type-imports, no-var */

// Node 18 implements the `fetch` API globally, but @types/node doesn't know that yet.

// Re-export undici fetch function and various classes and interfaces to global scope.
// These are classes and functions expected to be at global scope according to
// Node.js v18 API documentation.
// See: https://nodejs.org/dist/latest-v18.x/docs/api/globals.html
// See also: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/66824

declare namespace fetch {
	type _Request = typeof globalThis extends { onmessage: any }
		? {}
		: import("undici-types").Request;
	type _Response = typeof globalThis extends { onmessage: any }
		? {}
		: import("undici-types").Response;
	type _FormData = typeof globalThis extends { onmessage: any }
		? {}
		: import("undici-types").FormData;
	type _Headers = typeof globalThis extends { onmessage: any }
		? {}
		: import("undici-types").Headers;
	type _RequestInit = typeof globalThis extends { onmessage: any }
		? {}
		: import("undici-types").RequestInit;
	type Request = globalThis.Request;
	type Response = globalThis.Response;
	type Headers = globalThis.Headers;
	type FormData = globalThis.FormData;
	type RequestInit = globalThis.RequestInit;
	type RequestInfo = import("undici-types").RequestInfo;
	type HeadersInit = import("undici-types").HeadersInit;
	type BodyInit = import("undici-types").BodyInit;
	type RequestRedirect = import("undici-types").RequestRedirect;
	type RequestCredentials = import("undici-types").RequestCredentials;
	type RequestMode = import("undici-types").RequestMode;
	type ReferrerPolicy = import("undici-types").ReferrerPolicy;
	type Dispatcher = import("undici-types").Dispatcher;
	type RequestDuplex = import("undici-types").RequestDuplex;
}

interface RequestInit extends fetch._RequestInit {}

declare function fetch(input: fetch.RequestInfo, init?: RequestInit): Promise<Response>;

interface Request extends fetch._Request {}
declare var Request: typeof globalThis extends {
	onmessage: any;
	Request: infer T;
}
	? T
	: typeof import("undici-types").Request;

interface Response extends fetch._Response {}
declare var Response: typeof globalThis extends {
	onmessage: any;
	Response: infer T;
}
	? T
	: typeof import("undici-types").Response;

interface FormData extends fetch._FormData {}
declare var FormData: typeof globalThis extends {
	onmessage: any;
	FormData: infer T;
}
	? T
	: typeof import("undici-types").FormData;

interface Headers extends fetch._Headers {}
declare var Headers: typeof globalThis extends {
	onmessage: any;
	Headers: infer T;
}
	? T
	: typeof import("undici-types").Headers;
