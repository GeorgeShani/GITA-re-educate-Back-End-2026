export function renderHome(req, res) {
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
      <h1>Expense Tracker API</h1>

      <p>Welcome to the Expense Tracker API.</p>

      <h2>Available Routes</h2>

      <ul>
        <li><code>GET /expenses</code> - Get all expenses</li>
        <li><code>GET /expenses?page=1&take=10</code> - Paginated expenses</li>
        <li><code>GET /expenses/:id</code> - Get expense by ID</li>
        <li><code>POST /expenses</code> - Create expense</li>
        <li><code>PUT /expenses/:id</code> - Update expense</li>
        <li><code>DELETE /expenses/:id</code> - Delete expense (requires secret header)</li>
        <li><code>GET /random-fact</code> - Get a random fact</li>
      </ul>
    </body>
    </html>
  `);
}
