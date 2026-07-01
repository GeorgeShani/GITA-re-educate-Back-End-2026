/*  
  Homework 6 Description:

  1) Event Loop Sequence Challenge #1:
     Determine the log order of standard console.logs, setTimeouts (0ms and 100ms), and a resolved Promise.

  2) Event Loop Sequence Challenge #2:
     Determine the log order with nested microtasks (Promises) and macrotasks (setTimeouts).

  3) Custom Sleep Function:
     Create a promise-based sleep function that pauses execution using async/await.

  4) Random Number Matcher:
     Generate a random number between 1 and 20 every 1 second until it matches the target parameter.

  5) Countdown Timer:
     Log numbers from a target value down to 0 at a specified millisecond interval.
*/

// 1) Theoretical Task: First Logging Order
/*
  console.log("1"); 
  setTimeout(() => console.log("2"), 100); 
  setTimeout(() => console.log("3"), 0); 
  Promise.resolve().then(() => console.log("4")); 
  console.log("5");
*/
/*
  Sequence: "1", "5", "4", "3", "2"
  
  Analysis:
  - "1" and "5" are synchronous code (Call Stack), so they print immediately.
  - Promise.resolve().then() adds a callback to the Microtask Queue, which executes as soon as synchronous code completes -> prints "4".
  - setTimeout(..., 0) is placed in the Macrotask Queue and waits for the Microtask Queue to clear -> prints "3".
  - setTimeout(..., 100) executes last due to its 100ms delay -> prints "2".
*/


// 2) Theoretical Task: Second Logging Order
/*
  console.log("1"); 
  setTimeout(() => console.log("2"), 0); 
  Promise.resolve().then(() => { 
    console.log("3"); 
    setTimeout(() => console.log("4"), 0); 
  }); 
  console.log("5");
*/
/*
  Sequence: "1", "5", "3", "2", "4"
  
  Analysis:
  - "1" and "5" log directly as they are synchronous.
  - The first setTimeout(..., 0) [which logs "2"] goes to the Macrotask Queue.
  - The Promise callback goes to the Microtask Queue. Since microtasks have priority, the Promise executes next:
    * It logs "3".
    * The nested setTimeout(..., 0) [which logs "4"] is appended to the end of the Macrotask Queue.
  - Synchronous and microtasks are clear. The engine processes the Macrotask Queue:
    * The outer setTimeout runs first -> logs "2".
    * The nested setTimeout runs next -> logs "4".
*/


// 3) Custom Sleep Function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Example usage:
async function runSleepDemo() {
  console.log("Sleep demo started...");
  await sleep(1000);
  console.log("1 second has passed!");
}


// 4) Random Number Matcher
function matchRandomNumber(target) {
  if (target < 1 || target > 20) {
    console.log("Please enter a number between 1 and 20");
    return;
  }

  console.log(`Searching for target number: ${target}`);

  const intervalId = setInterval(() => {
    const randomNum = Math.floor(Math.random() * 20) + 1;
    console.log(`Generated: ${randomNum}`);

    if (randomNum === target) {
      console.log(`Match found! stopping execution: ${randomNum} === ${target}`);
      clearInterval(intervalId);
    }
  }, 1000);
}


// 5) Countdown Timer
function countdown(startNumber, intervalMs) {
  let current = startNumber;

  const intervalId = setInterval(() => {
    console.log(current);

    if (current === 0) {
      console.log("Timer stopped!");
      clearInterval(intervalId);
      return;
    }

    current--;
  }, intervalMs);
}


// Test Execution (Uncomment to test)

// runSleepDemo();
// matchRandomNumber(7);
// countdown(5, 500);