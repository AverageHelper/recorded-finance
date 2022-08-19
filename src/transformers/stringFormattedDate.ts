function pad(num: number, count: number = 2): string {
	return `${num}`.padStart(count, "0");
}

export function stringFormattedDate(date: Date | null): string | undefined {
	if (!date) return undefined;

	const year = pad(date.getFullYear(), 4);
	const month = pad(date.getMonth() + 1);
	const dayOfMonth = pad(date.getDate());
	const hour = pad(date.getHours());
	const minute = pad(date.getMinutes());

	return `${year}-${month}-${dayOfMonth}T${hour}:${minute}`;
}
