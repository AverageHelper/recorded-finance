import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, readdir, readFile } from "node:fs/promises";
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
 *
 * @deprecated
 */
export function resolvePath(path: string): string {
	if (path.startsWith("~")) {
		return join(homedir(), path.slice(1));
	}
	return resolve(path);
}

/**
 * Ensures that a directory exists at the given path.
 *
 * @deprecated
 */
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
 * Retrieves the names of the files in the folder at the given path.
 *
 * @param path The folder path.
 *
 * @deprecated
 */
export async function getFolderContents(path: string): Promise<Array<string>> {
	try {
		return await readdir(path, { encoding: "utf-8" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			console.warn(`No data found at path ${path}`);
			throw new NotFoundError();
		}
		throw error;
	}
}

/**
 * Retrieves the contents of the file at the given path.
 *
 * @param path The file path.
 * @returns The contents of the file.
 *
 * @deprecated
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
