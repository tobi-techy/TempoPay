import type { Command } from './parser'
import { getOrCreateUser, getWalletAddress } from './privy'
import { sendPayment, sendBatchPayment, getBalance } from './tempo'
import { createRequest, getRequest, getPendingRequestsFor, markRequestPaid } from './db'
import twilio from 'twilio'

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER!

const HELP_TEXT = `TempoPay Commands:
SEND $20 to +1234567890 lunch
SPLIT $60 to +123,+456,+789 dinner
REQUEST $50 from +1234567890 rent
PAY 1 (pay request #1)
BAL (check balance)
HELP`

export async function handleCommand(from: string, cmd: Command): Promise<string> {
  switch (cmd.type) {
    case 'HELP':
      return HELP_TEXT

    case 'BAL': {
      const user = await getOrCreateUser(from)
      const address = getWalletAddress(user)
      const balance = await getBalance(address)
      return `💰 Balance: $${balance} AlphaUSD\n📍 ${address.slice(0, 10)}...`
    }

    case 'SEND': {
      const [sender, recipient] = await Promise.all([
        getOrCreateUser(from),
        getOrCreateUser(cmd.recipient)
      ])
      const toAddress = getWalletAddress(recipient)
      const hash = await sendPayment(toAddress, cmd.amount, cmd.memo)
      return `✅ Sent $${cmd.amount} to ${cmd.recipient}${cmd.memo ? ` "${cmd.memo}"` : ''}\n🔗 ${hash.slice(0, 18)}...`
    }

    case 'SPLIT': {
      const [sender, ...recipients] = await Promise.all([
        getOrCreateUser(from),
        ...cmd.recipients.map(p => getOrCreateUser(p))
      ])
      const addresses = recipients.map(getWalletAddress)
      const each = cmd.amount / cmd.recipients.length
      const hash = await sendBatchPayment(addresses, each, cmd.memo)
      return `✅ Split $${cmd.amount} to ${cmd.recipients.length} people ($${each.toFixed(2)} each)\n🔗 ${hash.slice(0, 18)}...`
    }

    case 'REQUEST': {
      const id = createRequest(from, cmd.from, cmd.amount, cmd.memo)
      // Notify the person being requested
      await twilioClient.messages.create({
        to: cmd.from,
        from: TWILIO_PHONE,
        body: `💸 ${from} requested $${cmd.amount}${cmd.memo ? ` for "${cmd.memo}"` : ''}. Reply "PAY ${id}" to send.`
      })
      return `📤 Requested $${cmd.amount} from ${cmd.from}. They'll get a text!`
    }

    case 'PAY': {
      const req = getRequest(cmd.requestId)
      if (!req) throw new Error(`Request #${cmd.requestId} not found`)
      if (req.status !== 'pending') throw new Error('Already paid')
      if (req.to_phone !== from) throw new Error('This request is not for you')

      const [payer, requester] = await Promise.all([
        getOrCreateUser(from),
        getOrCreateUser(req.from_phone)
      ])
      const toAddress = getWalletAddress(requester)
      const hash = await sendPayment(toAddress, req.amount, req.memo)
      markRequestPaid(cmd.requestId)

      // Notify requester
      await twilioClient.messages.create({
        to: req.from_phone,
        from: TWILIO_PHONE,
        body: `✅ ${from} paid your $${req.amount} request!`
      })
      return `✅ Paid $${req.amount} to ${req.from_phone}\n🔗 ${hash.slice(0, 18)}...`
    }
  }
}
