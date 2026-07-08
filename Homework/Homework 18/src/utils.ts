export function addNumbers(a: number, b: number): number { 
  return a + b;
}

export function multiplyNumbers(a: number, b: number): number { 
  return a * b;
}

export function capitalizeString(str: string): string { 
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function filterEvenNumbers(numbers: number[]): number[] {
  return numbers.filter((num) => num % 2 === 0);
}

export function findMax(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot find max of empty array");
  }
  return Math.max(...numbers);
}

export function isPalindrome(str: string): boolean {
  const cleanStr = str.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
  const reversedStr = cleanStr.split("").reverse().join("");
  return cleanStr === reversedStr;
}

export function calculateFactorial(n: number): number {
  if (n < 0) {
    throw new Error("Factorial is not defined for negative numbers");
  }
  if (n === 0 || n === 1) {
    return 1;
  } else {
    return n * calculateFactorial(n - 1);
  }
}
