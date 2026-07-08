import express from "express";
import viewRoutes from "./routes/viewRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";

const app = express();

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// View routes render HTML pages; API routes handle data + mutations.
app.use("/", viewRoutes);
app.use("/api", apiRoutes);

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
