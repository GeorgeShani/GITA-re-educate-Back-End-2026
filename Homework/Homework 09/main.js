/*
  Homework 9. Object Oriented Programming

  Task 1 - Todo App

  Create a Todo class with the following properties:
  - id
  - title
  - isDone
  - createdAt

  Create a TodoList class that stores todos.

  Implement the following methods:

  - addTodo(title)
    Adds a new todo.

  - removeTodo(id)
    Removes a todo by id.

  - checkActiveTodo(id)
    Marks a todo as completed.

  - getAllTodos()
    Returns all todos.

  - getAllTodos({ active: true })
    Returns only active todos.

  - getAllTodos({ active: false })
    Returns only completed todos.
*/

class Todo {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.isDone = false;
    this.createdAt = new Date();
  }
}

class TodoList {
  constructor() {
    this.todos = [];
    this.nextId = 1;
  }

  addTodo(title) {
    const todo = new Todo(this.nextId++, title);
    this.todos.push(todo);
  }

  removeTodo(id) {
    this.todos = this.todos.filter(todo => todo.id !== id);
  }

  checkActiveTodo(id) {
    const todo = this.todos.find(todo => todo.id === id);

    if (todo) {
      todo.isDone = true;
    }
  }

  getAllTodos(filter = null) {
    if (!filter) {
      return this.todos;
    }

    if (filter.active === true) {
      return this.todos.filter(todo => !todo.isDone);
    }

    if (filter.active === false) {
      return this.todos.filter(todo => todo.isDone);
    }

    return this.todos;
  }
}

// Test Cases
const todoList = new TodoList();

todoList.addTodo("Learn JavaScript");
todoList.addTodo("Learn OOP");

todoList.checkActiveTodo(1);

console.log(todoList.getAllTodos());
console.log(todoList.getAllTodos({ active: true }));
console.log(todoList.getAllTodos({ active: false }));


/*
  Task 2 - Shopping Cart

  Create a ShoppingCart class.

  Each product should contain:
  - id
  - name
  - price
  - quantity

  Implement the following methods:

  - addToCart(product)
    Adds a product to the cart.

  - removeFromCart(id)
    Removes a product by id.

  - updateItem(id, updatedData)
    Updates product information.

  - calculateTotalPrice()
    Returns the total price of all products.
*/

class ShoppingCart {
  constructor() {
    this.items = [];
  }

  addToCart(product) {
    this.items.push(product);
  }

  removeFromCart(id) {
    this.items = this.items.filter(item => item.id !== id);
  }

  updateItem(id, updatedData) {
    const item = this.items.find(item => item.id === id);

    if (item) {
      Object.assign(item, updatedData);
    }
  }

  calculateTotalPrice() {
    return this.items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
  }
}

// Test Cases
const cart = new ShoppingCart();

cart.addToCart({
  id: 1,
  name: "Laptop",
  price: 2000,
  quantity: 1
});

cart.addToCart({
  id: 2,
  name: "Mouse",
  price: 50,
  quantity: 2
});

console.log(cart.calculateTotalPrice());

cart.updateItem(2, { quantity: 3 });

console.log(cart.calculateTotalPrice());


/*
  Task 3 - Library

  Create a Library class that stores books.

  Each book should contain:
  - id
  - title
  - author
  - releaseYear

  Implement the following methods:

  - addBook(book)
    Adds a new book.

  - removeBook(id)
    Removes a book by id.

  - listBooks()
    Returns all books.

  - listBooks(sortBy)
    Returns books sorted by the given property.
*/

class Library {
  constructor() {
    this.books = [];
  }

  addBook(book) {
    this.books.push(book);
  }

  removeBook(id) {
    this.books = this.books.filter(book => book.id !== id);
  }

  listBooks(sortBy = null) {
    if (!sortBy) {
      return this.books;
    }

    return this.books.toSorted((a, b) => {
      if (a[sortBy] > b[sortBy]) return 1;
      if (a[sortBy] < b[sortBy]) return -1;
      return 0;
    });
  }
}

// Test Cases
const library = new Library();

library.addBook({
  id: 1,
  title: "Clean Code",
  author: "Robert Martin",
  releaseYear: 2008
});

library.addBook({
  id: 2,
  title: "JavaScript",
  author: "John Smith",
  releaseYear: 2020
});

console.log(library.listBooks("releaseYear"));


/*
  Task 4 - Contact Manager

  Create a ContactManager class.

  Each contact should contain:
  - name
  - phone
  - email

  Validation Rules:
  - Two contacts cannot have the same email.
  - Two contacts cannot have the same phone number.

  Implement the following methods:

  - addNewContact(contact)
    Adds a new contact.

  - viewAllContacts()
    Returns all contacts.

  - updatePhone(email, newPhone)
    Updates a contact's phone number.

  - deleteContact(email)
    Deletes a contact by email.
*/

class ContactManager {
  constructor() {
    this.contacts = [];
  }

  addNewContact(contact) {
    const emailExists = this.contacts.some(
      item => item.email === contact.email
    );

    const phoneExists = this.contacts.some(
      item => item.phone === contact.phone
    );

    if (emailExists || phoneExists) {
      throw new Error("Email or phone already exists.");
    }

    this.contacts.push(contact);
  }

  viewAllContacts() {
    return this.contacts;
  }

  updatePhone(email, newPhone) {
    const phoneExists = this.contacts.some(
      item => item.phone === newPhone
    );

    if (phoneExists) {
      throw new Error("Phone number already exists.");
    }

    const contact = this.contacts.find(
      item => item.email === email
    );

    if (contact) {
      contact.phone = newPhone;
    }
  }

  deleteContact(email) {
    this.contacts = this.contacts.filter(
      item => item.email !== email
    );
  }
}

// Test Cases
const contacts = new ContactManager();

contacts.addNewContact({
  name: "George",
  phone: "555123456",
  email: "george@gmail.com"
});

contacts.addNewContact({
  name: "Nika",
  phone: "599111111",
  email: "nika@gmail.com"
});

contacts.updatePhone(
  "george@gmail.com",
  "599999999"
);

console.log(contacts.viewAllContacts());

contacts.deleteContact("nika@gmail.com");

console.log(contacts.viewAllContacts());