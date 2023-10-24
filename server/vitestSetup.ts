import { expect, vi } from "vitest";
import * as matchers from "jest-extended";
expect.extend(matchers);

// Mock out the logger, to keep our console clean while testing
vi.mock("./logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));
