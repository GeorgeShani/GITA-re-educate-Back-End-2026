const fs = require("fs/promises");
const path = require("path");

/*
Task Description

Folder Structure:

Task 1/
├── test/
│   ├── main.txt
│   └── test2/
│       └── main.txt
├── main.js
└── second.txt

Each .txt file contains random text.

Write a recursive function that:
1. Traverses all folders and subfolders.
2. Finds every .txt file.
3. Reads the contents of each .txt file.
4. Counts the total number of words across all text files.
5. Counts the total number of vowels across all text files.
6. Prints the final totals to the console.
*/

async function main(filePath, data = { words: 0, vowels: 0 }) {
  const entries = await fs.readdir(filePath);

  for (const entry of entries) {
    const fullPath = path.join(filePath, entry);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      await main(fullPath, data);
      continue;
    }

    const ext = path.extname(fullPath);

    if (ext === ".txt") {
      const fileData = await fs.readFile(fullPath, "utf-8");

      data.words += fileData
        .split(" ")
        .filter(word => word.length > 0).length;

      const vowels = "aeiouAEIOU";

      for (const char of fileData) {
        if (vowels.includes(char)) {
          data.vowels++;
        }
      }
    }
  }

  return data;
}

main(__dirname)
  .then(result => console.log(result))
  .catch(console.error);