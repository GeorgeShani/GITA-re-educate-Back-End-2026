/* 
  Homework 5 Description:

  - Create a function that removes a property from an object and returns a new object.
    Example:
    { name: "Ana", age: 25, city: "Tbilisi" }, "age"
    => { name: "Ana", city: "Tbilisi" }

  - Rank students by score in descending order and add a rank field.
    Example:
    [
      { name: "Ana", score: 50 },
      { name: "Nika", score: 80 },
      { name: "Luka", score: 70 }
    ]
    =>
    [
      { name: "Nika", score: 80, rank: 1 },
      { name: "Luka", score: 70, rank: 2 },
      { name: "Ana", score: 50, rank: 3 }
    ]

  - Find the object with the longest title.
    Example:
    [
      { title: "Up", year: 2009 },
      { title: "The Lord of the Rings", year: 2001 }
    ]
    => { title: "The Lord of the Rings", year: 2001 }

  - Calculate average age per department.
    Example:
    [
      { name: "Ana", dept: "HR", age: 25 },
      { name: "Nika", dept: "IT", age: 30 },
      { name: "Luka", dept: "IT", age: 22 }
    ]
    => { HR: 25, IT: 26 }

  - Count total words in all comments.
    Example:
    [
      { id: 1, comment: "Hello world" },
      { id: 2, comment: "This is great!" },
      { id: 3, comment: "" }
    ]
    => 5

  - Group users by department and sort each group by salary (desc).
    Example:
    [
      { name: "Ana", department: "HR", salary: 2000 },
      { name: "Nika", department: "IT", salary: 5000 },
      { name: "Luka", department: "IT", salary: 3500 },
      { name: "Mariam", department: "HR", salary: 3000 }
    ]

  - Calculate final cart price with discount.
    Example:
    [
      { title: "Laptop", price: 2000, quantity: 1, discountPercent: 10 },
      { title: "Mouse", price: 50, quantity: 2, discountPercent: 0 },
      { title: "Keyboard", price: 100, quantity: 1, discountPercent: 20 }
    ]
    => 1980

  - Convert users array into an object indexed by id.
    Example:
    [
      { id: 1, name: "Ana", age: 25 },
      { id: 2, name: "Nika", age: 30 },
      { id: 3, name: "Luka", age: 22 }
    ]
    =>
    {
      1: { ... },
      2: { ... },
      3: { ... }
    }
*/


// Remove property from object (immutable)
function deleteProperty(obj, prop) {
  const copy = { ...obj };
  delete copy[prop];
  return copy;
}

const user = {
  id: 1,
  username: "george",
  password: "secret123",
  email: "george@example.com"
};

console.log("Before delete:", user);

const safeUser = deleteProperty(user, "password");

console.log("After delete:", safeUser);


// Rank students by score
const students = [
  { name: "Ana", score: 50 },
  { name: "Nika", score: 80 },
  { name: "Luka", score: 70 }
];

const rankedStudents = students
  .toSorted((a, b) => b.score - a.score)
  .map((student, index) => ({
    ...student,
    rank: index + 1
  }));

console.log("Ranked students:", rankedStudents);


// Object with longest title
const movies = [
  { title: "Up", year: 2009 },
  { title: "The Lord of the Rings", year: 2001 }
];

const longestTitle = movies.reduce((longest, current) =>
  current.title.length > longest.title.length ? current : longest
);

console.log("Longest movie title:", longestTitle);


// Average age per department
const employees = [
  { name: "Ana", dept: "HR", age: 25 },
  { name: "Nika", dept: "IT", age: 30 },
  { name: "Luka", dept: "IT", age: 22 }
];

const grouped = employees.reduce((acc, { dept, age }) => {
  if (!acc[dept]) {
    acc[dept] = { sum: 0, count: 0 };
  }

  acc[dept].sum += age;
  acc[dept].count++;

  return acc;
}, {});

const averageAgeByDept = Object.fromEntries(
  Object.entries(grouped).map(([dept, data]) => [
    dept,
    Math.floor(data.sum / data.count)
  ])
);

console.log("Average age by department:", averageAgeByDept);


// Total word count in comments
const comments = [
  { id: 1, comment: "Hello world" },
  { id: 2, comment: "This is great!" },
  { id: 3, comment: "" }
];

function getTotalWords(comments) {
  return comments.reduce((total, { comment }) => {
    const trimmed = comment.trim();
    if (!trimmed) return total;

    return total + trimmed.split(" ").filter(w => w !== "").length;
  }, 0);
}

console.log("Total words:", getTotalWords(comments));


// Group users by department + sort salary desc
const users = [
  { name: "Ana", department: "HR", salary: 2000 },
  { name: "Nika", department: "IT", salary: 5000 },
  { name: "Luka", department: "IT", salary: 3500 },
  { name: "Mariam", department: "HR", salary: 3000 }
];

function groupByDepartment(users) {
  return users.reduce((acc, user) => {
    const { department } = user;

    if (!acc[department]) {
      acc[department] = [];
    }

    acc[department].push(user);
    acc[department].sort((a, b) => b.salary - a.salary);

    return acc;
  }, {});
}

console.log("Grouped users:", groupByDepartment(users));


// Cart total price with discount
const cart = [
  { title: "Laptop", price: 2000, quantity: 1, discountPercent: 10 },
  { title: "Mouse", price: 50, quantity: 2, discountPercent: 0 },
  { title: "Keyboard", price: 100, quantity: 1, discountPercent: 20 }
];

function getTotal(cart) {
  return cart.reduce((total, item) => {
    const finalPrice =
      item.price * item.quantity * (1 - item.discountPercent / 100);

    return total + finalPrice;
  }, 0);
}

console.log("Cart total:", getTotal(cart));


// Array to object by id
const usersList = [
  { id: 1, name: "Ana", age: 25 },
  { id: 2, name: "Nika", age: 30 },
  { id: 3, name: "Luka", age: 22 }
];

function arrayToObject(users) {
  return users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
}

console.log("Users object:", arrayToObject(usersList));