/**
 * Task Description
 *
 * Create an HTTP server that handles:
 *
 * GET /
 * - Redirects to /about
 *
 * GET /about
 * - Returns personal information
 *
 * GET /players
 * - Reads and returns all records from players.json
 *
 * GET /players?nation=georgia
 * - Filters records by nation
 *
 * GET /players/:id
 * - Returns a specific player by ID
 *
 * POST /players
 * - Accepts a new player object
 * - Validates required fields (firstName, lastName, nation, position)
 * - Validates position against allowed values:
 *   - goalkeeper
 *   - defender
 *   - midfielder
 *   - forward
 * - Automatically assigns incremental ID
 * - Saves it into players.json
 *
 * PUT /players/:id
 * - Updates an existing player by ID
 * - Validates position if provided
 *
 * DELETE /players/:id
 * - Deletes a player by ID
 * - Updates players.json accordingly
 */

const fs = require("fs/promises");
const http = require("http");
const url = require("url");

const FILE = "./players.json";

const VALID_POSITIONS = [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward"
];

async function readPlayers() {
  try {
    const data = await fs.readFile(FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
}

async function writePlayers(data) {
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function getNextId(players) {
  if (players.length === 0) return 1;
  return Math.max(...players.map(p => Number(p.id))) + 1;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && pathname === "/") {
    res.statusCode = 302;
    res.setHeader("Location", "/about");
    return res.end();
  }

  if (req.method === "GET" && pathname === "/about") {
    return res.end(JSON.stringify({
      firstName: "George",
      lastName: "Shanidze",
      hobbies: ["coding", "music", "travel"],
      stack: "Full-Stack Developer"
    }));
  }

  if (req.method === "GET" && pathname === "/players") {
    const players = await readPlayers();
    const { nation } = parsed.query;

    if (nation) {
      return res.end(JSON.stringify(
        players.filter(p => p.nation.toLowerCase() === nation.toLowerCase())
      ));
    }

    return res.end(JSON.stringify(players));
  }

  if (req.method === "GET" && pathname.startsWith("/players/")) {
    const id = pathname.split("/")[2];

    const players = await readPlayers();
    const player = players.find(p => String(p.id) === String(id));

    if (!player) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Player Not Found" }));
    }

    return res.end(JSON.stringify(player));
  }

  if (req.method === "POST" && pathname === "/players") {
    try {
      const body = await getBody(req);

      const { firstName, lastName, nation, position } = body;

      if (!firstName || !lastName || !nation || !position) {
        res.statusCode = 400;
        return res.end(JSON.stringify({
          error: "Missing required fields: firstName, lastName, nation, position"
        }));
      }

      if (!VALID_POSITIONS.includes(position.toLowerCase())) {
        res.statusCode = 400;
        return res.end(JSON.stringify({
          error: `Invalid position. Allowed: ${VALID_POSITIONS.join(", ")}`
        }));
      }

      const players = await readPlayers();

      const newRecord = {
        id: getNextId(players),
        firstName,
        lastName,
        nation,
        position: position.toLowerCase()
      };

      players.push(newRecord);
      await writePlayers(players);

      res.statusCode = 201;
      return res.end(JSON.stringify(newRecord));

    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  }

  if (req.method === "PUT" && pathname.startsWith("/players/")) {
    try {
      const id = pathname.split("/")[2];
      const body = await getBody(req);

      const players = await readPlayers();
      const index = players.findIndex(p => String(p.id) === String(id));

      if (index === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Player Not Found" }));
      }

      const updated = {
        ...players[index],
        ...body
      };

      if (updated.position) {
        if (!VALID_POSITIONS.includes(updated.position.toLowerCase())) {
          res.statusCode = 400;
          return res.end(JSON.stringify({
            error: `Invalid position. Allowed: ${VALID_POSITIONS.join(", ")}`
          }));
        }
        
        updated.position = updated.position.toLowerCase();
      }

      players[index] = updated;

      await writePlayers(players);

      return res.end(JSON.stringify(updated));
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  }

  if (req.method === "DELETE" && pathname.startsWith("/players/")) {
    const id = pathname.split("/")[2];

    const players = await readPlayers();
    const updated = players.filter(p => String(p.id) !== String(id));

    if (players.length === updated.length) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Not found" }));
    }

    await writePlayers(updated);

    return res.end(JSON.stringify({
      message: `Deleted record with ID ${id}`
    }));
  }

  res.statusCode = 404;
  return res.end(JSON.stringify({ error: "Route Not Found" }));
});

server.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});