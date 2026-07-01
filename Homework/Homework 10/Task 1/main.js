/*
  Task 1 - Fetch Users from API

  Fetch user data from:
  https://jsonplaceholder.typicode.com/users

  Create a new array containing only:
  - id
  - name
  - username
  - email

  Save the resulting array to users.json.

  Example output:

  [
    {
      "id": 1,
      "name": "Leanne Graham",
      "username": "Bret",
      "email": "Sincere@april.biz"
    }
  ]
*/

const fs = require("fs/promises");

async function main() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users");
  const users = await response.json();

  const mappedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email
  }));

  await fs.writeFile(
    "users.json",
    JSON.stringify(mappedUsers, null, 2)
  );
}

main();