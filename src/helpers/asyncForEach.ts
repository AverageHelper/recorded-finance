export async function asyncForEach<T>(
	array: ReadonlyArray<T>,
	callbackfn: (value: T, index: number, array: ReadonlyArray<T>) => Promise<void>
): Promise<void> {
	for (let index = 0; index < array.length; index++) {
		const element = array[index] as T;
		await callbackfn(element, index, array);
	}
}
