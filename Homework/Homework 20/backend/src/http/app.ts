import express, { type Express } from "express";
import { notFound, errorHandler } from "../middleware/errorHandler";
import { serviceInfo } from "./serviceInfo";
import apiRoutes from "../routes/index";
import cors from "cors";

/**
 * Builds the Express application: global middleware, the REST API under `/api`,
 * and the 404 + error handlers. Knows nothing about HTTP listening or sockets;
 * that wiring lives in `index.ts`.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json());

  app.get("/", serviceInfo);
  app.use("/api", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
