import { app } from "./main.js";
import { version } from "./version.js";
import request from "supertest";

// FIXME: This tests the prod database!!!

describe("Routes", () => {
	describe("GET /v0/", () => {
		test("responds with json", async () => {
			const response = await request(app) //
				.get("/v0/")
				.expect("Content-Type", /json/u);
			expect(response.status).toBe(200);
			expect(response.body).toStrictEqual({ message: "lol" });
		});
	});

	describe("GET /v0/ping", () => {
		test("responds with json", async () => {
			const response = await request(app) //
				.get("/v0/ping")
				.expect("Content-Type", /json/u);
			expect(response.status).toBe(200);
			expect(response.body).toStrictEqual({ message: "Pong!" });
		});
	});

	describe("GET /v0/version", () => {
		test("responds with json", async () => {
			const response = await request(app) //
				.get("/v0/version")
				.expect("Content-Type", /json/u);
			expect(response.status).toBe(200);
			expect(response.body).toStrictEqual({ message: `Accountable v${version}`, version });
		});
	});
});
