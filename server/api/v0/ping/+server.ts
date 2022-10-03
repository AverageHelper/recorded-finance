import type { RequestHandler } from "express";

export const GET: RequestHandler = (req, res) => res.json({ message: "Pong!" });
