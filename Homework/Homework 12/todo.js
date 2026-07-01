#!/usr/bin/env node

/**
 * TASK: TODO CLI TOOL
 *
 * A lightweight task manager CLI that allows users to create, update, delete,
 * and view todo items stored locally in a JSON file.
 *
 * Features:
 *
 * 1. List all todos
 *    - todo-cli show
 *    - Displays all stored todos with status indicators
 *
 * 2. Create a new todo
 *    - todo-cli add <todoName>
 *    - Adds a new todo with default status: isDone = false
 *
 * 3. Delete a todo
 *    - todo-cli delete <todoId>
 *    - Removes a todo permanently by its ID
 *
 * 4. Update a todo (option-based update)
 *    - todo-cli <todoId> --name <todoName>
 *    - Updates todo title using CLI options
 *
 * Todo structure:
 * {
 *   id: number,
 *   title: string,
 *   isDone: boolean
 * }
 *
 * Storage:
 * - Data is persisted locally in a JSON file (todos.json)
 * - File acts as a simple local database
 */

import { Command } from "commander";
import fs from "fs/promises";
import chalk from "chalk";

const program = new Command();
const DB_FILE = "todos.json";

/* helpers */

async function readTodos() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
}

async function writeTodos(todos) {
  await fs.writeFile(DB_FILE, JSON.stringify(todos, null, 2));
}

function print(todo) {
  console.log(
    chalk.green(`✔ #${todo.id}`),
    chalk.cyan(todo.title),
    todo.isDone ? chalk.gray("(done)") : chalk.yellow("(pending)")
  );
}

/* commands */

// SHOW
program
  .command("show")
  .description("Show all todos")
  .action(async () => {
    const todos = await readTodos();

    if (!todos.length) {
      return console.log(chalk.red("No todos found."));
    }

    todos.forEach(print);
  });

// ADD
program
  .command("add <title>")
  .description("Add a new todo")
  .action(async (title) => {
    const todos = await readTodos();

    const newTodo = {
      id: todos.length ? todos[todos.length - 1].id + 1 : 1,
      title,
      isDone: false,
    };

    todos.push(newTodo);
    await writeTodos(todos);

    console.log(chalk.green("Created:"));
    print(newTodo);
  });

// DELETE
program
  .command("delete <id>")
  .description("Delete todo by id")
  .action(async (id) => {
    const todos = await readTodos();

    const filtered = todos.filter((t) => t.id !== Number(id));
    const removed = todos.find((t) => t.id === Number(id));

    if (!removed) {
      return console.log(chalk.red("Todo not found."));
    }

    await writeTodos(filtered);

    console.log(chalk.red("Deleted:"));
    print(removed);
  });

// UPDATE
program
  .argument("<id>")
  .option("--name <title>", "update todo title")
  .option("--done", "mark todo as done")
  .option("--pending", "mark todo as not done")
  .description("Update todo using options")
  .action(async (id, options) => {
    const todos = await readTodos();

    const todo = todos.find((t) => t.id === Number(id));
    if (!todo) {
      return console.log(chalk.red("Todo not found."));
    }

    let updated = false;

    // update title
    if (options.name) {
      todo.title = options.name;
      updated = true;
    }

    // mark as done
    if (options.done) {
      todo.isDone = true;
      updated = true;
    }

    // mark as pending again
    if (options.pending) {
      todo.isDone = false;
      updated = true;
    }

    if (!updated) {
      return console.log(
        chalk.yellow("No changes provided. Use --name, --done, or --pending.")
      );
    }

    await writeTodos(todos);

    console.log(chalk.blue("Updated todo:\n"));
    print(todo);
  });

program.parse(process.argv);