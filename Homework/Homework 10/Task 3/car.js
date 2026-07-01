/*
  Task 3 - Car CLI Tool

  Create a command-line application that manages cars
  stored in cars.json.

  Each car should contain:
  - carName
  - carColor
  - carReleaseDate

  Commands:

  1) Add car:
     node car.js <carName> <carReleaseDate> <carColor>

  2) Show cars:
     node car.js show <year|color>
*/

const fs = require("fs");
const fsPromises = require("fs/promises");

async function main() {
  const fileName = "cars.json";

  // Create file if it doesn't exist
  if (!fs.existsSync(fileName)) {
    await fsPromises.writeFile(fileName, JSON.stringify([], null, 2));
  }

  const [, , command, arg1, arg2, arg3] = process.argv;

  const fileData = await fsPromises.readFile(fileName, "utf-8");
  let cars = JSON.parse(fileData);

  // Add Car
  if (command !== "show") {
    const carName = arg1;
    const carReleaseDate = arg2;
    const carColor = arg3;

    if (!carName || !carReleaseDate || !carColor) {
      console.log("Usage: node car.js <name> <releaseDate> <color>");
      return;
    }

    cars.push({
      name: carName,
      releaseDate: carReleaseDate,
      color: carColor
    });

    await fsPromises.writeFile(fileName, JSON.stringify(cars, null, 2));

    console.log("Car added successfully!");
    return;
  }

  // Show Cars
  const filterValue = arg1;

  if (!filterValue) {
    console.log("Usage: node car.js show <releaseDate | color>");
    return;
  }

  const filteredCars = cars.filter((car) =>
    car.releaseDate === filterValue || car.color === filterValue
  );

  if (filteredCars.length === 0) {
    console.log("No cars found.");
    return;
  }

  console.table(filteredCars);
}

main();