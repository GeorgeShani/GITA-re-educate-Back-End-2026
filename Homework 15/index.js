import "dotenv/config";
import express from "express";
import expensesRouter from "./routes/expenses.route.js";
import { renderHome } from "./controllers/home.controller.js";
import { getRandomFact } from "./controllers/randomFact.controller.js";
import { randomBlock } from "./middlewares/randomBlock.js";
import { connectToMongoDB } from "./config/db.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/", renderHome);

app.use("/expenses", expensesRouter);

app.get("/random-fact", randomBlock, getRandomFact);

async function startServer() {
  try {
    await connectToMongoDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
