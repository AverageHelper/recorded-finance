import { derived, get, writable } from "svelte/store";
import { getServerVersion } from "../transport/server.js";
import { logger } from "../logger.js";
import { NetworkError, PlatformError } from "../transport/errors/index.js";
import { StructError } from "superstruct";
import { t } from "../i18n.js";
import { toast } from "@zerodevx/svelte-toast";
import {
	bootstrap as _bootstrap,
	db,
	getUserStats,
	isWrapperInstantiated,
} from "../transport/db.js";

type ColorScheme = "light" | "dark";

export const preferredColorScheme = writable<ColorScheme>("light");
export const serverVersion = writable<string | Error | null>(null);
export const bootstrapError = writable<Error | null>(null);
export const totalSpace = writable<number | null>(null);
export const usedSpace = writable<number | null>(null);

export const serverLoadingError = derived(serverVersion, $serverVersion => {
	if ($serverVersion instanceof Error) return $serverVersion;
	return null;
});

export function watchColorScheme(): void {
	const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const isLightMode = window.matchMedia("(prefers-color-scheme: light)").matches;
	const isNotSpecified = window.matchMedia("(prefers-color-scheme: no-preference)").matches;
	const hasNoSupport = !isDarkMode && !isLightMode && !isNotSpecified;

	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", e => e.matches && activateDarkMode());
	window
		.matchMedia("(prefers-color-scheme: light)")
		.addEventListener("change", e => e.matches && activateLightMode());

	if (isDarkMode) activateDarkMode();
	if (isLightMode) activateLightMode();
	if (isNotSpecified || hasNoSupport) {
		logger.warn("System color scheme not supported. Defaulting to light.");
		activateLightMode();
	}
}

export function activateDarkMode(): void {
	preferredColorScheme.set("dark");
}

export function activateLightMode(): void {
	preferredColorScheme.set("light");
}

export async function updateUserStats(): Promise<void> {
	const { usedSpace: _usedSpace, totalSpace: _totalSpace } = await getUserStats(db);
	usedSpace.set(_usedSpace);
	totalSpace.set(_totalSpace);
}

export function bootstrap(): void {
	if (isWrapperInstantiated()) return;

	try {
		_bootstrap();
	} catch (error) {
		if (error instanceof Error) {
			bootstrapError.set(error);
		} else {
			bootstrapError.set(new Error(JSON.stringify(error)));
		}
	}
}

export async function loadServerVersion(): Promise<void> {
	if (typeof get(serverVersion) === "string") return;
	bootstrap();

	try {
		serverVersion.set("loading");
		serverVersion.set(await getServerVersion(db));
	} catch (error) {
		logger.error(error);
		if (error instanceof Error) {
			serverVersion.set(error);
		} else {
			serverVersion.set(new Error(JSON.stringify(error)));
		}
	}
}

export function handleError(error: unknown): void {
	let message: string;
	if (error instanceof PlatformError) {
		message = error.code;
	} else if (error instanceof StructError) {
		message = `ValidationError: ${error.message}`;
	} else if (error instanceof NetworkError || error instanceof Error) {
		message = error.message;
	} else {
		message = JSON.stringify(error);
	}

	if (message.includes("auth/invalid-email")) {
		toast.push(`${t("error.auth.invalid-email")} (You should never see this)`, {
			classes: ["toast-error"],
		});
	} else if (message.includes("auth/wrong-password") || message.includes("auth/user-not-found")) {
		toast.push(t("error.network.wrong-credentials"), { classes: ["toast-error"] });
	} else if (message.includes("auth/email-already-in-use")) {
		toast.push(t("error.auth.account-already-exists"), { classes: ["toast-error"] });
	} else {
		toast.push(message, { classes: ["toast-error"] });
	}
	logger.error(error);
}
