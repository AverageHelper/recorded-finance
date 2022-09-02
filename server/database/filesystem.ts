import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { NotFoundError } from "../errors/index.js";

/**
 * Resolves the given path, treating `~` as the user's home directory.
 *
 * @example
 * ```ts
 * resolvePath("~"); // "/Users/foo" on macOS
 * resolvePath("~/"); // "/Users/foo/" on macOS
 * resolvePath("/"); // "/"
 *
 * // "/Users/foo/Documents/Accountable" on macOS
 * resolvePath("/Users/foo/Documents/Accountable") ===
 *   resolvePath("~/Documents/Accountable");
 * ```
 */
export function resolvePath(path: string): string {
	if (path.startsWith("~")) {
		return join(homedir(), path.slice(1));
	}
	return resolve(path);
}

/** Removes the item at the given path from the filesystem. */
export async function deleteItem(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return; // not found means it's gone! :D
		}
		throw error;
	}
}

/** Ensures that a directory exists at the given path */
export async function ensure(path: string): Promise<void> {
	try {
		await mkdir(path, { recursive: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			return; // already exists! :D
		}
		throw error;
	}
}

/**
 * Returns the operating system's default directory for temporary files as a string.
 */
export function tmpDir(): string {
	return tmpdir();
}

/**
 * Returns the operating system's default directory for temporary files as a string.
 */
export function tmpDir(): string {
	return tmpdir();
}

/**
 * Returns a `Promise` that resolves `true` if a file exists at
 * the given path, `false` otherwise.
 *
 * @see https://stackoverflow.com/a/17699926
 */
export async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

/**
 * Retrieves the contents of the file at the given path.
 *
 * @param path The file path
 * @returns The contents of the file.
 */
export async function getFileContents(path: string): Promise<string> {
	try {
		return await readFile(path, { encoding: "utf-8" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			console.warn(`No data found at path ${path}`);
			throw new NotFoundError();
		}
		throw error;
	}
}

/**
 * Moves the item from the source path to the destination.
 *
 * @param src The path to the file to move.
 * @param dest The file's new path.
 */
export async function moveFile(src: string, dest: string): Promise<void> {
	try {
		await deleteItem(dest);
		await rename(src, dest);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new NotFoundError();
		}
		throw error;
	}
}
