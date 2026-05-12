/*
  Homework 3 Description:

  - Write a function that takes an array of numbers as a parameter
    and returns the average of all numbers in the array.
    Example: calculateAverage([1, 2, 3]) => 2

  - Write a function that takes a number as a parameter
    and returns an array of reversed digits.
    Example: reverseNumberToArray(35231) => [1, 3, 2, 5, 3]

  - Write a function that takes 2 arrays as parameters
    and returns the elements that do not exist in the second array.
    Example: arrayDifference([1, 2, 2, 3], [2]) => [1, 3]

  - Write a function that finds the second biggest number in an array.
    Example: findSecondBiggestNumber([10, 40, 20, 5, 30]) => 30

  - Write a function that returns only palindrome words from an array.
    Example: getPalindromes(["mom", "car", "level"]) => ["mom", "level"]

  - Write a function that returns the most frequent number in an array.
    Example: mostFrequent([4, 5, 6, 5, 4, 5]) => 5
*/


// Function that calculates the average of numbers in an array
function calculateAverage(nums) {
  let sum = 0;

  for (let i = 0; i < nums.length; i++) {
    sum += nums[i];
  }

  return sum / nums.length;
}


// Function that converts a number into an array of reversed digits
function reverseNumberToArray(num) {
  if (num === 0) {
    return [0];
  }

  const reversedArr = [];

  while (num > 0) {
    reversedArr.push(num % 10);
    num = Math.floor(num / 10);
  }

  return reversedArr;
}


// Function that returns the difference between 2 arrays
function arrayDifference(a, b) {
  let difference = [];

  for (let i = 0; i < a.length; i++) {
    if (!b.includes(a[i]) && !difference.includes(a[i])) {
      difference.push(a[i]);
    }
  }

  return difference;
}


// Function that finds the second biggest number in an array
function findSecondBiggestNumber(arr) {
  return [...arr].sort((a, b) => b - a)[1];
}


// Function that returns palindrome strings from an array
function getPalindromes(strArr) {
  const palindromes = [];

  for (let i = 0; i < strArr.length; i++) {
    if (isPalindrome(strArr[i])) {
      palindromes.push(strArr[i]);
    }
  }

  return palindromes;
}


// Function that checks if a string is a palindrome
function isPalindrome(str) {
  return str === str.split('').reverse().join('');
}


// Function that returns the most frequently used number in an array
function mostFrequent(arr) {
  let mostRepeated = arr[0];
  let maxCount = 0;

  for (let i = 0; i < arr.length; i++) {
    let count = 0;

    for (let j = 0; j < arr.length; j++) {
      if (arr[i] === arr[j]) {
        count++;
      }
    }

    if (count > maxCount) {
      maxCount = count;
      mostRepeated = arr[i];
    }
  }

  return mostRepeated;
}


// Test cases
console.log(calculateAverage([1, 2, 3, 4, 5])); // Output: 3
console.log(reverseNumberToArray(35231)); // Output: [1, 3, 2, 5, 3]
console.log(arrayDifference([1, 2, 2, 2, 3], [2])); // Output: [1, 3]
console.log(findSecondBiggestNumber([10, 40, 20, 5, 30])); // Output: 30
console.log(getPalindromes(["mom", "car", "level", "dog"])); // Output: ["mom", "level"]
console.log(mostFrequent([4, 5, 6, 5, 4, 5])); // Output: 5