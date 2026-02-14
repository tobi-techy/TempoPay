export type Command = 
  | { type: 'SEND'; amount: number; recipient: string; memo: string }
  | { type: 'SPLIT'; amount: number; recipients: string[]; memo: string }
  | { type: 'REQUEST'; amount: number; from: string; memo: string }
  | { type: 'PAY'; requestId: number }
  | { type: 'BAL' }
  | { type: 'HELP' }

const PHONE_REGEX = /\+?\d{10,15}/g

export function parseCommand(input: string): Command {
  const text = input.trim()
  const upper = text.toUpperCase()

  if (upper === 'BAL' || upper === 'BALANCE') {
    return { type: 'BAL' }
  }

  if (upper === 'HELP') {
    return { type: 'HELP' }
  }

  // PAY <id>
  const payMatch = upper.match(/^PAY\s+(\d+)$/)
  if (payMatch) {
    return { type: 'PAY', requestId: parseInt(payMatch[1]) }
  }

  // SEND $<amount> to <phone> [memo]
  const sendMatch = text.match(/^SEND\s+\$?([\d.]+)\s+(?:to\s+)?(\+?\d{10,15})\s*(.*)?$/i)
  if (sendMatch) {
    return {
      type: 'SEND',
      amount: parseFloat(sendMatch[1]),
      recipient: normalizePhone(sendMatch[2]),
      memo: sendMatch[3]?.trim() || ''
    }
  }

  // SPLIT $<amount> to <phone1>,<phone2>,... [memo]
  const splitMatch = text.match(/^SPLIT\s+\$?([\d.]+)\s+(?:to\s+)?([\d,+\s]+)\s*(.*)?$/i)
  if (splitMatch) {
    const phones = splitMatch[2].match(PHONE_REGEX)
    if (!phones || phones.length < 2) {
      throw new Error('SPLIT requires at least 2 recipients')
    }
    return {
      type: 'SPLIT',
      amount: parseFloat(splitMatch[1]),
      recipients: phones.map(normalizePhone),
      memo: splitMatch[3]?.trim() || ''
    }
  }

  // REQUEST $<amount> from <phone> [memo]
  const reqMatch = text.match(/^REQUEST\s+\$?([\d.]+)\s+(?:from\s+)?(\+?\d{10,15})\s*(.*)?$/i)
  if (reqMatch) {
    return {
      type: 'REQUEST',
      amount: parseFloat(reqMatch[1]),
      from: normalizePhone(reqMatch[2]),
      memo: reqMatch[3]?.trim() || ''
    }
  }

  throw new Error('Unknown command. Text HELP for usage.')
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}
