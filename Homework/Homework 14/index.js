import express from "express";
import expensesRouter from "./routes/expenses.route.js";
import { renderHome } from "./controllers/home.controller.js";
import { getRandomFact } from "./controllers/randomFact.controller.js";
import { randomBlock } from "./middlewares/randomBlock.js";

const app = express();

const PORT = 3000;

app.use(express.json());

app.get("/", renderHome);

app.use("/expenses", expensesRouter);

app.get("/random-fact", randomBlock, getRandomFact);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
