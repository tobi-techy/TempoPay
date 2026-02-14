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

export interface PaymentRequest {
  id: number
  from_phone: string
  to_phone: string
  amount: number
  memo: string
  status: string
}

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
