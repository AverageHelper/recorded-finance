/**
 * Performs the specified asynchronous action for each element in
 * an array.
 *
 * @param array The array over which to iterate.
 * @param callbackfn A function that accepts up to three arguments.
 * `asyncForEach` calls the `callbackfn` function one time for each
 * element in the array, sequentially, as the function resolves.
 */
export async function asyncForEach<T>(
	array: ReadonlyArray<T>,
	callbackfn: (value: T, index: number, array: ReadonlyArray<T>) => Promise<void>
): Promise<void> {
	for (let index = 0; index < array.length; index++) {
		const element = array[index] as T;
		await callbackfn(element, index, array);
	}
}
