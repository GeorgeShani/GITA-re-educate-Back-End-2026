/*
  Homework 2 Description:

  - Write a function that takes a string as a parameter and returns the abbreviation of that string.
    Example: getAbbreviation('John Doe') => "J.D"

  - Write a function that takes a number as an argument and returns the sum of its digits.
    Example: getSumOfDigits(123) => 6
    Explanation: 1 + 2 + 3

  - Write a function that takes a string as a parameter and removes all duplicate characters from it.
    Example: removeDuplicates('banana') => 'ban'

  - Write a function that removes all spaces from a string.
    Example: removeSpaces('1 2 aab') => '12aab'
    You must use a for loop.

  - Write a function that takes a sentence as a parameter and reverses each word individually.
    Example: reverseEachWord('Hello World') => "olleH dlroW"

*/

// Function to get the abbreviation of a string
function getAbbreviation(str) {
  let words = str.split(' ');
  let abbreviation = '';

  for (let i = 0; i < words.length; i++) {
    abbreviation += words[i][0].toUpperCase() + '.';
  }

  return abbreviation.trim();
}

// Function to get the sum of digits in a number
function getSumOfDigits(num) {
  let sum = 0;
  
  while (num > 0) {
    sum += num % 10;
    num = Math.floor(num / 10);
  }

  return sum;
}

// Function to remove duplicate characters from a string
function removeDuplicates(str) {
  let result = '';

  for (let i = 0; i < str.length; i++) {
    if (!result.includes(str[i])) {
      result += str[i];
    }
  }

  return result;
}


// Function to remove all spaces from a string
function removeSpaces(str) {
  let result = '';

  for (let i = 0; i < str.length; i++) {
    if (str[i] !== ' ') {
      result += str[i];
    }
  }

  return result;
}


// Function to reverse each word in a sentence
function reverseEachWord(str) {
  let words = str.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].split('').reverse().join('');
  }
  
  return words.join(' ');
}


// Test cases
console.log(getAbbreviation("George Shanidze")); // Output: "G.S."
console.log(getSumOfDigits(1234)); // Output: 10
console.log(removeDuplicates("Banana")); // Output: "Ban"
console.log(removeSpaces("I NEED SO MUCH SPACE")); // Output: "INEEDSOMUCHSPACE"
console.log(reverseEachWord("Hello World")); // Output: "olleH dlroW"