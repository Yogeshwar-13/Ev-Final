import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { handleApiRequest } from "./api-handler";

const app = express();
const PORT = process.env["PORT"] || 5000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers,
      ...(["GET", "HEAD"].includes(req.method) || req.body === undefined
        ? {}
        : { body: JSON.stringify(req.body) }),
    });
    const response = await handleApiRequest(request);
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    if (req.method === "HEAD") return res.end();
    return res.send(await response.text());
  } catch (error) {
    return next(error);
  }
});

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  console.error("API request failed", err);
  const details =
    process.env["NODE_ENV"] === "production"
      ? undefined
      : err instanceof Error
        ? err.message
        : "Internal server error";
  return res.status(500).json({
    success: false,
    error: "Something went wrong while processing the request",
    ...(details !== undefined ? { details } : {}),
  });
});

if (
  process.env["NODE_ENV"] !== "test" &&
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  app.listen(PORT, () => {
    console.log(`EV Finder API listening on http://localhost:${PORT}`);
  });
}

export default app;
