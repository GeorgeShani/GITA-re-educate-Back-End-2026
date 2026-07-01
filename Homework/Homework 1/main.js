/*
  Homework 1 Description:

  - Write a function that converts Celsius to Fahrenheit and returns the result.
  - Write a function that takes a string as an argument and returns the reversed version of that string.
  - Write a function that takes a sentence as a parameter and counts how many words are in it. (We did not do this in class, but you can search for it.)
  - Write a function that takes a word as a parameter and returns how many vowels are in that word.
  - Write a function that takes a number as a parameter and returns the factorial of that number.
  - Write a function that takes a number as a parameter and returns the sum of only the even numbers from 0 up to that number.
  - Write a function that takes a student’s score as an argument and returns the student’s grade: A, B, C, D, E, or F.
  - Write a function that takes a password as a parameter. Your goal is to check whether it:
    - is longer than 8 characters,
    - contains a number,
    - and contains at least one capital letter.

*/

// Function to convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
  return (celsius * 9 / 5) + 32;
}

// Function to reverse a string
function reverseString(str) { 
  return str.split('').reverse().join('');
}

// Function to count the number of words in a sentence
function countWords(sentence) {
  return sentence.split(' ').length;
}

// Function to count the number of vowels in a word
function countVowels(word) {
  const vowels = 'aeiouAEIOU';
  let count = 0;

  for (let char of word) {
    if (vowels.includes(char)) {
      count++;
    }
  }

  return count;
}

// Function to calculate the factorial of a number
function factorial(num) {
  if (num === 0 || num === 1) {
    return 1;
  }
  
  return num * factorial(num - 1);
}

// Function to sum even numbers up to a given number
function sumEvenNumbers(num) { 
  let sum = 0;
  for (let i = 0; i <= num; i++) {
    if (i % 2 === 0) {
      sum += i;
    }
  }

  return sum;
}

// Function to determine a student's grade based on their score
function getGrade(score) {
  switch (true) {
    case score >= 90:
      return 'A';
    case score >= 80:
      return 'B';
    case score >= 70:
      return 'C';
    case score >= 60:
      return 'D';
    case score >= 50:
      return 'E';
    default:
      return 'F';
  }
}

// Function to validate a password based on given criteria
function validatePassword(password) {
  const numbers = '0123456789';
  const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const hasNumber = numbers.split('').some(char => password.includes(char));
  const hasCapitalLetter = uppercaseLetters.split('').some(char => password.includes(char));
  const isLongEnough = password.length > 8;

  return hasNumber && hasCapitalLetter && isLongEnough;
}

// Test cases
console.log(celsiusToFahrenheit(0)); // 32
console.log(reverseString("Hello")); // "olleH"
console.log(countWords("Hello world!")); // 2
console.log(countVowels("Hello")); // 2
console.log(factorial(5)); // 120
console.log(sumEvenNumbers(10)); // 30
console.log(getGrade(85)); // "B"
console.log(validatePassword("Password123")); // true