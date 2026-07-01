/*
Task 4:
  Create an input where the user can only enter numbers.
  After the user enters a number, send a request to:
  https://myfakeapi.com/api/cars/{id}

  Replace {id} with the user's input.

  The API will return car information which should be displayed in the DOM.

  If the user enters an invalid id (e.g. 9999), the backend will return an error.
  Handle the error and show an alert telling the user to enter a valid id.
*/

const input = document.getElementById("carInput");
const button = document.getElementById("searchBtn");
const result = document.getElementById("carResult");

button.addEventListener("click", async () => {
  const id = input.value;

  if (!id) {
    alert("Please enter a valid numeric ID");
    return;
  }

  try {
    const response = await fetch(`https://myfakeapi.com/api/cars/${id}`);

    if (!response.ok) {
      throw new Error("Invalid ID");
    }

    const data = await response.json();
    const car = data.Car || data.car || data;

    result.innerHTML = `
            <h3>${car.car || car.name || "Car Info"}</h3>
            <p>Model: ${car.car_model || "N/A"}</p>
            <p>Year: ${car.car_model_year || "N/A"}</p>
            <p>Price: ${car.price || "N/A"}</p>
            <p>Color: ${car.car_color || "N/A"}</p>
        `;

  } catch (error) {
    console.error(error);
    alert("Invalid car ID. Please enter a correct one.");
    result.innerHTML = "";
  }
});