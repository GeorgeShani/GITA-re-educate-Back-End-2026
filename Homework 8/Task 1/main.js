/*
Task 1:
  Write a function that logs the mouse coordinates (clientX, clientY) only after the mouse has stopped moving.
  Use the debounce technique to prevent continuous logging while the mouse is moving.

  Hint:
  window.addEventListener('mousemove', (e) => {
      console.log(e.clientX, e.clientY);
  });

  Requirements:
  - Use a debounce function
  - Log coordinates only when mouse movement stops for a short delay (e.g. 500ms)
*/

function debounce(callback, delay) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

const logMousePosition = debounce((e) => {
  console.log("X:", e.clientX, "Y:", e.clientY);
}, 500);

window.addEventListener("mousemove", logMousePosition);