/*
  Task 2 - Phone CLI Tool

  Create a command-line application that manages contacts
  stored in a contacts.json file.

  Each contact should contain:
  - name
  - number

  Supported commands:

  - node phone.js add <number> <name>
    Adds a new contact.
    Validation:
      * Number must be unique.
      * Number must contain only digits.

  - node phone.js delete <number>
    Removes a contact by phone number.

  - node phone.js show
    Displays all contacts.

  Data is persisted in contacts.json.

  Example:

  node phone.js add 555151515 Nika
  node phone.js add 599123456 George
  node phone.js show
  node phone.js delete 555151515
*/


const fs = require("fs");
const fsPromises = require("fs/promises");

async function main() {
  const fileName = "contacts.json";
  if (!fs.existsSync(fileName)) {
    await fsPromises.writeFile(fileName, JSON.stringify([], null, 2));
  }

  const [, , operation, number, name] = process.argv;

  const fileData = await fsPromises.readFile(fileName, "utf-8");
  let phoneNumbers = JSON.parse(fileData);

  if (operation === "add") {
    if (!number || !name) {
      console.log("Usage: node phone.js add <number> <name>");
      return;
    }

    if (!/^\d+$/.test(number)) {
      console.log("Phone number must contain only digits.");
      return;
    }

    const phoneNumberExists = phoneNumbers.find(
      (phoneNumber) => phoneNumber.number === number
    );

    if (phoneNumberExists) {
      console.log("Phone number already exists.");
      return;
    }

    phoneNumbers.push({ name, number });

    await fsPromises.writeFile(
      fileName,
      JSON.stringify(phoneNumbers, null, 2)
    );

    console.log("Contact added successfully.");
  } else if (operation === "delete") {
    if (!number) {
      console.log("Usage: node phone.js delete <number>");
      return;
    }

    const originalLength = phoneNumbers.length;

    phoneNumbers = phoneNumbers.filter(
      (phoneNumber) => phoneNumber.number !== number
    );

    if (originalLength === phoneNumbers.length) {
      console.log("Phone number not found.");
      return;
    }

    await fsPromises.writeFile(
      fileName,
      JSON.stringify(phoneNumbers, null, 2)
    );

    console.log("Contact deleted successfully.");
  } else if (operation === "show") {
    if (phoneNumbers.length === 0) {
      console.log("No contacts found.");
      return;
    }

    console.table(phoneNumbers);
  } else {
    console.log(`
Available commands:

node phone.js add <number> <name>
node phone.js delete <number>
node phone.js show
`);
  }
}

main();