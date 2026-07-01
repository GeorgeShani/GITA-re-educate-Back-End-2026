/*
  Homework 7 Description:

  - Fetch data from an incorrect URL. If the request fails,
    retry the operation up to 5 times.
    URL: https://jsonplaceholde.typicode.com

  - Fetch data from two different URLs simultaneously.
    Log only the results from the one that resolves first.
    URLs: https://dummyjson.com/users, https://jsonplaceholder.typicode.com/users

  - Fetch product data, filter the items, and log
    only the products whose price is greater than 10.
    URL: https://dummyjson.com/products

  - Fetch user data and filter for users whose profession is "web developer".
    Log only the following properties: firstName, lastName, city, email, and phone.
    URL: https://dummyjson.com/users

  - Fetch data from four different APIs concurrently (at the same time).
    Convert all resolved results to JSON and log them.
    URLs: https://dummyjson.com/recipes, https://dummyjson.com/comments, 
          https://dummyjson.com/todos, https://dummyjson.com/quotes
*/


// Fetch Data with Retry Mechanism
async function fetchWithRetry(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed. Retrying...`);
      if (i === retries - 1) throw error;
    }
  }
}

// Race Fetching
async function raceRequests() {
  const url1 = "https://dummyjson.com/users";
  const url2 = "https://jsonplaceholder.typicode.com/users";

  try {
    const fastestResponse = await Promise.race([fetch(url1), fetch(url2)]);
    const data = await fastestResponse.json();
    console.log("Fastest response data:", data);
  } catch (error) {
    console.error("Error in race:", error.message);
  }
}

// Filter Products by Price
async function filterExpensiveProducts() {
  try {
    const response = await fetch("https://dummyjson.com/products");
    const data = await response.json();

    const expensiveProducts = data.products.filter(product => product.price > 10);
    console.log("Products priced above 10:", expensiveProducts);
  } catch (error) {
    console.error("Error fetching products:", error.message);
  }
}

// Filter and Map Users
async function filterWebDevelopers() {
  try {
    const response = await fetch("https://dummyjson.com/users");
    const data = await response.json();

    const developers = data.users
      .filter(user => user.company?.title?.toLowerCase() === "web developer")
      .map(user => ({
        firstName: user.firstName,
        lastName: user.lastName,
        city: user.address?.city,
        email: user.email,
        phone: user.phone
      }));

    console.log("Web Developers:", developers);
  } catch (error) {
    console.error("Error fetching users:", error.message);
  }
}

// Concurrent Multi-Fetch
async function fetchAllConcurrent() {
  const urls = [
    "https://dummyjson.com/recipes",
    "https://dummyjson.com/comments",
    "https://dummyjson.com/todos",
    "https://dummyjson.com/quotes"
  ];

  try {
    const responses = await Promise.all(urls.map(url => fetch(url)));
    const data = await Promise.all(responses.map(res => {
      if (!res.ok) throw new Error(`Failed to fetch ${res.url}`);
      return res.json();
    }));

    console.log("All concurrent data loaded:", data);
  } catch (error) {
    console.error("Error in concurrent fetch:", error.message);
  }
}

// Main
async function main() {
  try {
    const retryResult = await fetchWithRetry("https://jsonplaceholde.typicode.com");
    if (retryResult) console.log(retryResult);
  } catch (error) {
    console.error("Retry fetch failed permanently, continuing execution:", error.message);
  }

  raceRequests();
  filterExpensiveProducts();
  filterWebDevelopers();
  fetchAllConcurrent();
}

main();