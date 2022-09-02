import type { LocaleCode } from "i18n";

export function toTitleCase(locale: LocaleCode, str: string): string;
export function toTitleCase(locale: LocaleCode, str: null): null;
export function toTitleCase(locale: LocaleCode, str: undefined): undefined;

export function toTitleCase(
	locale: LocaleCode,
	str: string | null | undefined
): string | null | undefined {
	if (str === null || str === undefined) {
		return str;
	}

	const first = str[0];
	if (first === undefined || !first) {
		return str;
	}

	const rest = str.slice(1);
	return `${first.toLocaleUpperCase(locale)}${rest}`;
}
