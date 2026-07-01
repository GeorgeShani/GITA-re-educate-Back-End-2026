/*
Task 2:
  Create an HTML page with a button. On every button click, send a request to the API:
  https://dummyjson.com/quotes

  After receiving the response, display a random quote on the page (similar to how we displayed a random cat fact).

  Requirements:
  - Add a button in HTML
  - On click, fetch data from the API
  - Select a random quote from the returned list
  - Display the quote and its author on the page
*/

const button = document.getElementById("getQuoteBtn");
const quoteBox = document.getElementById("quoteBox");

button.addEventListener("click", async () => {
  try {
    const response = await fetch("https://dummyjson.com/quotes");
    const data = await response.json();

    // pick a random quote from the list
    const randomIndex = Math.floor(Math.random() * data.quotes.length);
    const quote = data.quotes[randomIndex];

    quoteBox.innerHTML = `
            <p>"${quote.quote}"</p>
            <strong>- ${quote.author}</strong>
        `;
  } catch (error) {
    console.error("Error fetching quote:", error);
    quoteBox.innerHTML = "Something went wrong while fetching quote.";
  }
});