import express from "express";
import type { Express, Request, Response } from "express";
import { connectDB } from "./config/db";
import productRoutes from "./routes/product.routes";
import "dotenv/config";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response): void => {
  res.json({
    message: "Welcome to the Products API",
    status: "ok",
    timestamp: new Date().toISOString(),
    endpoints: {
      products: "GET /api/products",
      productSummary: "GET /api/products/summary",
      productById: "GET /api/products/:id",
      createProduct: "POST /api/products",
      updateProduct: "PUT /api/products/:id (admin only)",
      deleteProduct: "DELETE /api/products/:id (admin only)",
    },
  });
});

app.use("/api/products", productRoutes);

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error: unknown) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
