import { Database } from 'bun:sqlite'

const db = new Database('tempopay.db')

db.run(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    amount REAL NOT NULL,
    memo TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch())
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    recipient TEXT,
    memo TEXT,
    hash TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    nickname TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(phone, nickname)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS spending_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    daily_limit REAL NOT NULL,
    spent_today REAL DEFAULT 0,
    last_reset INTEGER DEFAULT (unixepoch())
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS wallets (
    phone TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )
`)

export interface PaymentRequest {
  id: number
  from_phone: string
  to_phone: string
  amount: number
  memo: string
  status: string
}

export interface Transaction {
  id: number
  phone: string
  type: string
  amount: number
  recipient: string | null
  memo: string | null
  hash: string | null
  created_at: number
}

export interface Contact {
  id: number
  phone: string
  nickname: string
  contact_phone: string
  created_at: number
}

export interface SpendingLimit {
  id: number
  phone: string
  daily_limit: number
  spent_today: number
  last_reset: number
}

// Request functions
export function createRequest(from: string, to: string, amount: number, memo: string): number {
  const result = db.run(
    'INSERT INTO requests (from_phone, to_phone, amount, memo) VALUES (?, ?, ?, ?)',
    [from, to, amount, memo]
  )
  return Number(result.lastInsertRowid)
}

export function getRequest(id: number): PaymentRequest | null {
  return db.query('SELECT * FROM requests WHERE id = ?').get(id) as PaymentRequest | null
}

export function getPendingRequestsFor(phone: string): PaymentRequest[] {
  return db.query('SELECT * FROM requests WHERE to_phone = ? AND status = ?').all(phone, 'pending') as PaymentRequest[]
}

export function markRequestPaid(id: number) {
  db.run('UPDATE requests SET status = ? WHERE id = ?', ['paid', id])
}

// Transaction history functions
export function recordTransaction(phone: string, type: string, amount: number, recipient: string | null, memo: string | null, hash: string | null) {
  db.run(
    'INSERT INTO transactions (phone, type, amount, recipient, memo, hash) VALUES (?, ?, ?, ?, ?, ?)',
    [phone, type, amount, recipient, memo, hash]
  )
}

export function getRecentTransactions(phone: string, limit: number = 10): Transaction[] {
  return db.query('SELECT * FROM transactions WHERE phone = ? ORDER BY created_at DESC LIMIT ?').all(phone, limit) as Transaction[]
}

// Contact nickname functions
export function addContact(phone: string, nickname: string, contactPhone: string) {
  db.run(
    'INSERT OR REPLACE INTO contacts (phone, nickname, contact_phone) VALUES (?, ?, ?)',
    [phone, nickname.toLowerCase(), contactPhone]
  )
}

export function getContact(phone: string, nickname: string): Contact | null {
  return db.query('SELECT * FROM contacts WHERE phone = ? AND nickname = ?').get(phone, nickname.toLowerCase()) as Contact | null
}

export function getContactByNickname(phone: string, nickname: string): string | null {
  const contact = getContact(phone, nickname)
  return contact ? contact.contact_phone : null
}

export function listContacts(phone: string): Contact[] {
  return db.query('SELECT * FROM contacts WHERE phone = ? ORDER BY nickname').all(phone) as Contact[]
}

// Spending limit functions
export function setSpendingLimit(phone: string, dailyLimit: number) {
  db.run(
    'INSERT OR REPLACE INTO spending_limits (phone, daily_limit, spent_today, last_reset) VALUES (?, ?, 0, ?)',
    [phone, dailyLimit, Math.floor(Date.now() / 1000)]
  )
}

export function getSpendingLimit(phone: string): SpendingLimit | null {
  return db.query('SELECT * FROM spending_limits WHERE phone = ?').get(phone) as SpendingLimit | null
}

export function updateSpentAmount(phone: string, amount: number) {
  const limit = getSpendingLimit(phone)
  if (!limit) return
  
  const now = Math.floor(Date.now() / 1000)
  const dayInSeconds = 86400
  const isNewDay = (now - limit.last_reset) >= dayInSeconds
  
  if (isNewDay) {
    db.run(
      'UPDATE spending_limits SET spent_today = ?, last_reset = ? WHERE phone = ?',
      [amount, now, phone]
    )
  } else {
    db.run(
      'UPDATE spending_limits SET spent_today = spent_today + ? WHERE phone = ?',
      [amount, phone]
    )
  }
}

export function canSpend(phone: string, amount: number): boolean {
  const limit = getSpendingLimit(phone)
  if (!limit) return true // No limit set
  
  const now = Math.floor(Date.now() / 1000)
  const dayInSeconds = 86400
  const isNewDay = (now - limit.last_reset) >= dayInSeconds
  
  const spent = isNewDay ? 0 : limit.spent_today
  return (spent + amount) <= limit.daily_limit
}

// Wallet persistence
export interface WalletRecord {
  phone: string
  wallet_id: string
  address: string
}

export function saveWallet(phone: string, walletId: string, address: string) {
  db.run(
    'INSERT OR REPLACE INTO wallets (phone, wallet_id, address) VALUES (?, ?, ?)',
    [phone, walletId, address]
  )
}

export function getWallet(phone: string): WalletRecord | null {
  return db.query('SELECT * FROM wallets WHERE phone = ?').get(phone) as WalletRecord | null
}
