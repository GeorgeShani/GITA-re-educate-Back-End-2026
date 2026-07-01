/*
Task 3:
  Write a function that fetches user data from the API:
  https://dummyjson.com/users

  Your goal is to implement pagination.

  Requirements:
  - Default limit is 30 users per page
  - Total users are 200+
  - Calculate number of pages using: total / limit
  - Use skip formula: skip = (page - 1) * limit
  - Fetch users based on current page
  - Display users on the page
  - Add "Previous" and "Next" buttons to navigate pages
*/

const usersContainer = document.getElementById("users");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

let currentPage = 1;
const limit = 30;
let totalPages = 0;

async function fetchUsers(page) {
  const skip = (page - 1) * limit;

  const response = await fetch(`https://dummyjson.com/users?limit=${limit}&skip=${skip}`);
  const data = await response.json();

  totalPages = Math.ceil(data.total / limit);

  renderUsers(data.users);
  updatePagination();
}

function renderUsers(users) {
  usersContainer.innerHTML = users.map(user => `
        <p>${user.firstName} ${user.lastName} - ${user.email}</p>
    `).join("");
}

function updatePagination() {
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    fetchUsers(currentPage);
  }
});

nextBtn.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    fetchUsers(currentPage);
  }
});

fetchUsers(currentPage);