import type { Dinero } from "dinero.js";
import type { LocaleCode } from "../i18n";
import { toFormat } from "dinero.js";

type NegativeStyle = "accounting" | "standard";

export function toCurrency(
	locale: LocaleCode,
	dinero: Dinero<number>,
	negativeStyle: NegativeStyle = "accounting"
): string {
	return toFormat(dinero, ({ amount, currency }) => {
		const formatter = Intl.NumberFormat(locale, {
			style: "currency",
			currency: currency.code,
			currencySign: negativeStyle,
		});
		return formatter.format(amount);
	});
}
