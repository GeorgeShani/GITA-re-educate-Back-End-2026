/*
  Task 4 - Text Analyzer

  Create a file named random.txt with any sentence.

  Your task:
  - Read random.txt
  - Count:
    - number of words
    - number of vowels
    - number of characters (excluding spaces)

  Then save the result into result.json in this format:

  {
    word: 20,
    vowel: 64,
    chars: 152
  }
*/

const fs = require("fs");
const fsPromises = require("fs/promises");

async function main() {
  const fileName = "random.txt";
  const resultFile = "result.json";

  // Ensure file exists (optional safety)
  if (!fs.existsSync(fileName)) {
    console.log("random.txt not found!");
    return;
  }

  const text = await fsPromises.readFile(fileName, "utf-8");

  // Word Count
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = words.length;

  // Vowel Count
  const vowelsList = ["a", "e", "i", "o", "u"];
  let vowelCount = 0;

  for (const char of text.toLowerCase()) {
    if (vowelsList.includes(char)) {
      vowelCount++;
    }
  }

  // Char Count (no spaces)
  const charCount = text.replace(/\s/g, "").length;

  // Result
  const result = {
    word: wordCount,
    vowel: vowelCount,
    chars: charCount
  };

  await fsPromises.writeFile(
    resultFile,
    JSON.stringify(result, null, 2)
  );

  console.log("Analysis completed. Saved to result.json");
}

main();