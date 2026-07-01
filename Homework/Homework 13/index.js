import express from "express";
import fs from "fs/promises";

const app = express();

const PORT = 3000;
const DB_FILE = "./expenses.json";
const SECRET_KEY = "random123";
const MAX_TAKE = 50;

app.use(express.json());

// Helpers
async function readExpenses() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeExpenses(expenses) {
  await fs.writeFile(
    DB_FILE,
    JSON.stringify(expenses, null, 2)
  );
}

// Welcome page with API documentation and navigation links.
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Expense API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
        }
        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <h1>💰 Expense Tracker API</h1>

      <p>Welcome to the Expense Tracker API.</p>

      <h2>Available Routes</h2>

      <ul>
        <li><code>GET /expenses</code> - Get all expenses</li>
        <li><code>GET /expenses?page=1&take=10</code> - Paginated expenses</li>
        <li><code>GET /expenses/:id</code> - Get expense by ID</li>
        <li><code>POST /expenses</code> - Create expense</li>
        <li><code>PUT /expenses/:id</code> - Update expense</li>
        <li><code>DELETE /expenses/:id</code> - Delete expense (requires secret header)</li>
      </ul>

      <h3>Quick Start</h3>

      <p>
        View all expenses:
        <a href="/expenses">/expenses</a>
      </p>

      <p>
        View paginated expenses:
        <a href="/expenses?page=1&take=5">
          /expenses?page=1&take=5
        </a>
      </p>
    </body>
    </html>
  `);
});

// GET ALL + PAGINATION
app.get("/expenses", async (req, res) => {
  try {
    const expenses = await readExpenses();

    const page = Number(req.query.page) || 1;
    const take = Number(req.query.take) || 10;

    if (page < 1 || take < 1) {
      return res.status(400).json({
        message: "page and take must be positive numbers"
      });
    }

    if (take > MAX_TAKE) {
      return res.status(400).json({
        message: `take cannot exceed ${ MAX_TAKE } `
      });
    }

    const start = (page - 1) * take;
    const end = start + take;

    return res.status(200).json({
      page,
      take,
      total: expenses.length,
      totalPages: Math.ceil(expenses.length / take),
      data: expenses.slice(start, end)
    });
  } catch {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// GET BY ID
app.get("/expenses/:id", async (req, res) => {
  try {
    const expenses = await readExpenses();

    const expense = expenses.find(
      expense => expense.id === Number(req.params.id)
    );

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found"
      });
    }

    return res.status(200).json(expense);
  } catch {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// CREATE
app.post("/expenses", async (req, res) => {
  try {
    const { category, price } = req.body;

    if (!category || price === undefined) {
      return res.status(400).json({
        message: "category and price are required"
      });
    }

    if (typeof price !== "number" || price < 10) {
      return res.status(400).json({
        message: "price must be a number and at least 10"
      });
    }

    const expenses = await readExpenses();

    const newExpense = {
      id:
        expenses.length > 0
          ? Math.max(...expenses.map(exp => exp.id)) + 1
          : 1,
      category,
      price,
      createdAt: new Date().toISOString()
    };

    expenses.push(newExpense);

    await writeExpenses(expenses);

    return res.status(201).json(newExpense);
  } catch {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// UPDATE
app.put("/expenses/:id", async (req, res) => {
  try {
    const expenses = await readExpenses();

    const index = expenses.findIndex(
      expense => expense.id === Number(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        message: "Expense not found"
      });
    }

    const { category, price } = req.body;

    if (price !== undefined) {
      if (typeof price !== "number" || price < 10) {
        return res.status(400).json({
          message: "price must be a number and at least 10"
        });
      }

      expenses[index].price = price;
    }

    if (category) {
      expenses[index].category = category;
    }

    await writeExpenses(expenses);

    return res.status(200).json(expenses[index]);
  } catch {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// DELETE WITH SECRET HEADER
app.delete("/expenses/:id", async (req, res) => {
  try {
    const secret = req.headers.secret;

    if (secret !== SECRET_KEY) {
      return res.status(403).json({
        message: "Invalid secret key"
      });
    }

    const expenses = await readExpenses();

    const filteredExpenses = expenses.filter(
      expense => expense.id !== Number(req.params.id)
    );

    if (filteredExpenses.length === expenses.length) {
      return res.status(404).json({
        message: "Expense not found"
      });
    }

    await writeExpenses(filteredExpenses);

    return res.status(200).json({
      message: "Expense deleted successfully"
    });
  } catch {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${ PORT } `);
});
