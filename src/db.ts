import Database from 'better-sqlite3'

const db = new Database('tempopay.db')

db.exec(`
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
  const result = db.prepare(
    'INSERT INTO requests (from_phone, to_phone, amount, memo) VALUES (?, ?, ?, ?)'
  ).run(from, to, amount, memo)
  return result.lastInsertRowid as number
}

export function getRequest(id: number): PaymentRequest | undefined {
  return db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as PaymentRequest | undefined
}

export function getPendingRequestsFor(phone: string): PaymentRequest[] {
  return db.prepare(
    'SELECT * FROM requests WHERE to_phone = ? AND status = ?'
  ).all(phone, 'pending') as PaymentRequest[]
}

export function markRequestPaid(id: number) {
  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run('paid', id)
}
