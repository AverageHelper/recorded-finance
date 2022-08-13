import type { LocaleCode } from "i18n";

/**
 * @returns a timestamp string representing the date.
 */
export function toTimestamp(locale: LocaleCode, date: Date): string {
	const formatter = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
		hour12: isLocale12Hr(locale),
	});
	return formatter.format(date);
}

/**
 * @returns `true` if the current locale is a 12-hr formatting locale, instead of a 24-hr one.
 */
export function isLocale12Hr(locale: LocaleCode): boolean {
	// Initial idea from https://stackoverflow.com/a/60437579.
	// Here, we default to 24-hr time because it's better, and
	// `formatToParts` doesn't detect that I've set 24-hr time
	// in a 12-hr locale.
	return new Intl.DateTimeFormat(locale).resolvedOptions().hour12 ?? false;
}
