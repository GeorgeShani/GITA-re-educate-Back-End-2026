import { 
  Rectangle, 
  Circle, 
  calculateRectangleArea, 
  calculateRectanglePerimeter, 
  calculateCircleArea, 
  calculateCirclePerimeter 
} from "./shapes.js";

import {
  addNumbers,
  multiplyNumbers,
  capitalizeString,
  filterEvenNumbers,
  findMax,
  isPalindrome,
  calculateFactorial
} from "./utils.js";

import { BankAccount } from "./bankAccount.js";

// Task 1: Shapes & Math Utilities Test Cases
console.log("--- TASK 1: SHAPES & MATH UTILITIES ---");

// Testing the standalone functions using structural plain objects (matching original JS)
const plainRectangle = { width: 5, height: 8 };
const plainCircle = { radius: 3 };

const rectangleArea = calculateRectangleArea(plainRectangle);
const rectanglePerimeter = calculateRectanglePerimeter(plainRectangle);

const circleArea = calculateCircleArea(plainCircle);
const circlePerimeter = calculateCirclePerimeter(plainCircle);

console.log(`(Plain Object) Rectangle Area: ${rectangleArea}, Perimeter: ${rectanglePerimeter}`);
console.log(`(Plain Object) Circle Area: ${circleArea}, Perimeter: ${circlePerimeter}`);

// Creating Rectangle and Circle Class instances and invoking their methods (Advisable OOP approach)
console.log("\nUsing advising OOP Classes:");
const rectInstance = new Rectangle(5, 8);
const circleInstance = new Circle(3);

console.log(`(Class Instance) Rectangle Width: ${rectInstance.width}, Height: ${rectInstance.height}`);
console.log(`(Class Instance) Rectangle Area: ${rectInstance.getArea()}, Perimeter: ${rectInstance.getPerimeter()}`);
console.log(`(Class Instance) Circle Radius: ${circleInstance.radius}`);
console.log(`(Class Instance) Circle Area: ${circleInstance.getArea().toFixed(4)}, Perimeter: ${circleInstance.getPerimeter().toFixed(4)}`);

// Testing independent utility functions
console.log("\nTesting Independent Functions:");
const sumResult = addNumbers(5, 3);
const multiplicationResult = multiplyNumbers(4, 7);
const capitalizedString = capitalizeString("javascript is fun");
const evenNumbers = filterEvenNumbers([1, 2, 3, 4, 5, 6, 7, 8]);

console.log(`Sum: ${sumResult}`);
console.log(`Multiplication: ${multiplicationResult}`);
console.log(`Capitalized String: ${capitalizedString}`);
console.log(`Even Numbers: [${evenNumbers.join(", ")}]`);

const maxNumber = findMax([23, 56, 12, 89, 43]);
const isPalindromeResult = isPalindrome("A man, a plan, a canal, Panama");
const factorialResult = calculateFactorial(5);

console.log(`Max Number: ${maxNumber}`);
console.log(`Is Palindrome: ${isPalindromeResult}`);
console.log(`Factorial: ${factorialResult}`);

// Task 2: BankAccount Class Test Cases
console.log("\n--- TASK 2: BANK ACCOUNT DEMONSTRATION ---");

// Create at least 2 instances of BankAccount
const account1 = new BankAccount("ACC-1001", 500.00);
const account2 = new BankAccount("ACC-2002", 150.00);

console.log("Initial Accounts State:");
console.log(account1.getAccountInfo());
console.log(account2.getAccountInfo());

// Perform various operations
console.log("\nPerforming Operations...");

// 1. Deposit into Account 1
console.log(`\nDepositing $200.00 into ${account1.accountNumber}...`);
account1.deposit(200.00);
console.log(account1.getAccountInfo());

// 2. Withdraw from Account 2
console.log(`\nWithdrawing $50.00 from ${account2.accountNumber}...`);
account2.withdraw(50.00);
console.log(account2.getAccountInfo());

// 3. Transfer from Account 1 to Account 2
console.log(`\nTransferring $150.00 from ${account1.accountNumber} to ${account2.accountNumber}...`);
account1.transferFunds(150.00, account2);

console.log("\nPost-Transfer State:");
console.log(account1.getAccountInfo());
console.log(account2.getAccountInfo());

// Verify the transactionHistory of the created accounts
console.log(`\nTransaction History for ${account1.accountNumber}:`);
account1.getTransactionHistory().forEach((tx, idx) => {
  console.log(`  [${idx + 1}] ${tx.date.toISOString()} - Type: ${tx.type.toUpperCase()}, Amount: $${tx.amount.toFixed(2)} (${tx.details})`);
});

console.log(`\nTransaction History for ${account2.accountNumber}:`);
account2.getTransactionHistory().forEach((tx, idx) => {
  console.log(`  [${idx + 1}] ${tx.date.toISOString()} - Type: ${tx.type.toUpperCase()}, Amount: $${tx.amount.toFixed(2)} (${tx.details})`);
});
