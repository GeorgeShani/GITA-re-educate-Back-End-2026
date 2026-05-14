/*
  Homework 4 Description:

  - Remove the last character from each string in the array.
    Example:
    ["one", "two", "three"] => ["on", "tw", "thre"]

  - Find the sum of the 2 smallest numbers in the array.
    Example:
    [19, 5, 42, 2, 77] => 7

  - Calculate the sum of all numbers in the array
    using the forEach method.
    Example:
    [10, 12, 4, 2] => 28

  - Return only the words whose length is greater than 5,
    convert them to uppercase, and join them with "#".
    Example:
    ["cat", "parrot", "dog", "elephant"] => "PARROT#ELEPHANT"

  - Group students by class and calculate
    the average grade for each class.
    Example:
    [
      { name: "Ann", cls: "A", grade: 90 },
      { name: "Ben", cls: "B", grade: 75 },
      { name: "Cara", cls: "A", grade: 80 }
    ]

    Result:
    { A: 85, B: 75 }
*/


// 1. Remove last character from each string
const words = ["one", "two", "three"];

const removedLast = words.map((word) => word.slice(0, -1));

console.log(removedLast); // Output: ["on", "tw", "thre"]


// 2. Sum of 2 smallest numbers
const numbers = [19, 5, 42, 2, 77];

const sortedNumbers = numbers.toSorted((a, b) => a - b);

const sum = sortedNumbers[0] + sortedNumbers[1];

console.log(sum); // Output: 7


// 3. Sum array numbers using forEach
const nums = [10, 12, 4, 2];

let total = 0;

nums.forEach((num) => total += num);

console.log(total); // Output: 28


// 4. Filter long words, uppercase them, and join with "#"
const animals = ["cat", "parrot", "dog", "elephant"];

const result = animals
  .filter((word) => word.length > 5)
  .map((word) => word.toUpperCase())
  .join("#");

console.log(result); // Output: "PARROT#ELEPHANT"


// 5. Group students by class and calculate average grade
const students = [
  { name: "Ann", cls: "A", grade: 90 },
  { name: "Ben", cls: "B", grade: 75 },
  { name: "Cara", cls: "A", grade: 80 }
];

const grouped = {};

students.forEach((student) => {
  if (!grouped[student.cls]) {
    grouped[student.cls] = [];
  }

  grouped[student.cls].push(student.grade);
});

const averages = {};

for (const cls in grouped) {
  const grades = grouped[cls];

  const sumOfGrades = grades.reduce((sum, grade) => sum + grade, 0);

  averages[cls] = sumOfGrades / grades.length;
}

console.log(averages); // Output: { A: 85, B: 75 }