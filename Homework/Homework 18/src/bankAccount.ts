export type TransactionType =
  | 'initial_deposit'
  | 'deposit'
  | 'withdrawal'
  | 'transfer_in'
  | 'transfer_out';

export interface TransactionRecord {
  type: TransactionType;
  amount: number;
  date: Date;
  details?: string;
}

export class BankAccount {
  private _balance: number;
  private readonly _accountNumber: string;
  private readonly _transactionHistory: TransactionRecord[] = [];

  constructor(accountNumber: string, initialBalance: number) {
    if (!accountNumber.trim()) {
      throw new Error("Account number must not be empty");
    }
    if (initialBalance < 0) {
      throw new Error("Initial balance cannot be negative");
    }
    this._accountNumber = accountNumber;
    this._balance = initialBalance;
    this.recordTransaction('initial_deposit', initialBalance, 'Initial balance');
  }

  // Getters to restrict outside mutation of internal state
  get accountNumber(): string {
    return this._accountNumber;
  }

  get balance(): number {
    return this._balance;
  }

  getAccountInfo(): string {
    return `Account Number: ${this._accountNumber}, Balance: $${this._balance.toFixed(2)}`;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }
    this._balance += amount;
    this.recordTransaction('deposit', amount, 'Deposit');
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error("Withdrawal amount must be positive");
    }
    if (amount > this._balance) {
      throw new Error("Insufficient funds");
    }
    this._balance -= amount;
    this.recordTransaction('withdrawal', amount, 'Withdrawal');
  }

  transferFunds(amount: number, recipient: BankAccount): void {
    if (amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }
    if (this === recipient) {
      throw new Error("Cannot transfer funds to the same account");
    }
    if (amount > this._balance) {
      throw new Error("Insufficient funds for transfer");
    }

    this._balance -= amount;
    this.recordTransaction('transfer_out', amount, `Transfer to ${recipient.accountNumber}`);

    recipient._balance += amount;
    recipient.recordTransaction('transfer_in', amount, `Transfer from ${this.accountNumber}`);
  }

  getTransactionHistory(): TransactionRecord[] {
    // Deep-copy each record (including its Date) so neither the array,
    // the record objects, nor their dates can be mutated from outside.
    return this._transactionHistory.map((transaction) => ({
      ...transaction,
      date: new Date(transaction.date),
    }));
  }

  private recordTransaction(type: TransactionType, amount: number, details?: string): void {
    this._transactionHistory.push({
      type,
      amount,
      date: new Date(),
      details
    });
  }
}
