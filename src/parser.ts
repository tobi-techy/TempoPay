export type Command = 
  | { type: 'SEND'; amount: number; recipient: string; memo: string; currency?: string }
  | { type: 'SPLIT'; amount: number; recipients: string[]; memo: string }
  | { type: 'REQUEST'; amount: number; from: string; memo: string }
  | { type: 'PAY'; requestId: number }
  | { type: 'BAL' }
  | { type: 'HISTORY' }
  | { type: 'ADD'; nickname: string; phone: string }
  | { type: 'LIMIT'; amount: number }
  | { type: 'QR'; amount?: number; memo?: string }
  | { type: 'FUND'; amount: number }
  | { type: 'TAG'; tag: string }
  | { type: 'HELP' }

const PHONE_REGEX = /\+?\d{10,15}/g

export function parseCommand(input: string): Command {
  const text = input.trim()
  const upper = text.toUpperCase()

  if (upper === 'BAL' || upper === 'BALANCE') {
    return { type: 'BAL' }
  }

  if (upper === 'HISTORY') {
    return { type: 'HISTORY' }
  }

  if (upper === 'HELP' || upper === 'HI' || upper === 'HELLO' || upper === 'START') {
    return { type: 'HELP' }
  }

  // FUND $<amount> - add test funds
  const fundMatch = text.match(/^FUND\s+\$?([\d.]+)$/i)
  if (fundMatch) {
    return { type: 'FUND', amount: parseFloat(fundMatch[1]!) }
  }

  // TAG <username> - set your payment tag
  const tagMatch = text.match(/^TAG\s+(\w+)$/i)
  if (tagMatch) {
    return { type: 'TAG', tag: tagMatch[1]! }
  }

  // QR [$amount] [memo]
  const qrMatch = text.match(/^QR(?:\s+\$?([\d.]+))?(?:\s+(.+))?$/i)
  if (qrMatch) {
    return {
      type: 'QR',
      amount: qrMatch[1] ? parseFloat(qrMatch[1]) : undefined,
      memo: qrMatch[2]?.trim()
    }
  }

  const payMatch = upper.match(/^PAY\s+(\d+)$/)
  if (payMatch && payMatch[1]) {
    return { type: 'PAY', requestId: parseInt(payMatch[1]) }
  }

  // ADD @<nickname> <phone>
  const addMatch = text.match(/^ADD\s+@(\w+)\s+(\+?\d{10,15})$/i)
  if (addMatch) {
    return {
      type: 'ADD',
      nickname: addMatch[1]!,
      phone: normalizePhone(addMatch[2]!)
    }
  }

  // LIMIT $<amount>/day
  const limitMatch = text.match(/^LIMIT\s+\$?([\d.]+)(?:\/day)?$/i)
  if (limitMatch) {
    return {
      type: 'LIMIT',
      amount: parseFloat(limitMatch[1]!)
    }
  }

  // SEND $<amount> to <phone|@nickname|$tag> [memo]
  const sendMatch = text.match(/^SEND\s+\$?([\d.]+)\s*(?:to\s+)?(\$\w+|@\w+|\+?\d{10,15})\s*(.*)?$/i)
  if (sendMatch && sendMatch[2]) {
    return {
      type: 'SEND',
      amount: parseFloat(sendMatch[1]!),
      recipient: sendMatch[2],
      memo: sendMatch[3]?.trim() || ''
    }
  }

  const splitMatch = text.match(/^SPLIT\s+\$?([\d.]+)\s+(?:to\s+)?([\d,+\s@\w$]+)\s*(.*)?$/i)
  if (splitMatch) {
    const phones = splitMatch[2]!.match(/(\$\w+|@\w+|\+?\d{10,15})/g)
    if (!phones || phones.length < 2) {
      throw new Error('SPLIT requires at least 2 recipients')
    }
    return {
      type: 'SPLIT',
      amount: parseFloat(splitMatch[1]!),
      recipients: phones,
      memo: splitMatch[3]?.trim() || ''
    }
  }

  const reqMatch = text.match(/^REQUEST\s+\$?([\d.]+)\s+(?:from\s+)?(@\w+|\+?\d{10,15})\s*(.*)?$/i)
  if (reqMatch) {
    return {
      type: 'REQUEST',
      amount: parseFloat(reqMatch[1]!),
      from: reqMatch[2]!,
      memo: reqMatch[3]?.trim() || ''
    }
  }

  throw new Error('Unknown command. Text HELP for usage.')
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}
