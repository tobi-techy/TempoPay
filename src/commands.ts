import type { Command } from './parser'
import { getOrCreateUser, getWalletAddress, getWalletId } from './privy'
import { sendPayment, sendBatchPayment, getAllBalances, fundUserWallet, TOKENS } from './tempo'
import { 
  createRequest, getRequest, markRequestPaid, 
  recordTransaction, getRecentTransactions,
  addContact, getContactByNickname,
  setSpendingLimit, canSpend, updateSpentAmount
} from './db'
import { getTxLink, generateReceiptText, generateFailedReceiptText, generateQRFile } from './utils'
import twilio from 'twilio'

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER!
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || `whatsapp:${TWILIO_PHONE}`

const HELP_TEXT = `💸 *TempoPay* - Send money via text!

*Commands:*
• SEND $20 to +1234567890 lunch
• SEND $20 to @mom _(contact)_
• SEND $20 BETA to +123... _(FX swap)_
• SPLIT $60 to +123,+456,+789 dinner
• REQUEST $50 from +1234567890 rent
• PAY 1 _(pay request #1)_
• BAL _(check balance)_
• HISTORY _(recent payments)_
• ADD @mom +1234567890 _(save contact)_
• LIMIT $100/day _(spending limit)_
• QR $50 coffee _(payment QR code)_
• FUND $100 _(add test funds)_

Powered by Tempo ⚡`

export async function handleCommand(rawFrom: string, cmd: Command, isWhatsApp = false): Promise<string> {
  // Normalize the sender's phone number
  const from = normalizePhone(rawFrom)
  
  const sendNotification = async (to: string, body: string, mediaUrl?: string) => {
    const toNumber = isWhatsApp ? `whatsapp:${to}` : to
    const fromNumber = isWhatsApp ? WHATSAPP_NUMBER : TWILIO_PHONE
    const opts: any = { to: toNumber, from: fromNumber, body }
    if (mediaUrl) opts.mediaUrl = [mediaUrl]
    try {
      await twilioClient.messages.create(opts)
    } catch {}
  }

  const resolveRecipient = (recipient: string): string => {
    if (recipient.startsWith('@')) {
      const nickname = recipient.slice(1)
      const phone = getContactByNickname(from, nickname)
      if (!phone) throw new Error(`Contact @${nickname} not found. Use ADD @${nickname} +phone`)
      return phone
    }
    return normalizePhone(recipient)
  }

  switch (cmd.type) {
    case 'HELP':
      return HELP_TEXT

    case 'FUND': {
      // Fund user wallet from sponsor (for testing)
      const user = await getOrCreateUser(from)
      const hash = await fundUserWallet(user.address, cmd.amount)
      return `✅ Added *$${cmd.amount}* test funds to your wallet!\n🔗 ${getTxLink(hash)}`
    }

    case 'QR': {
      const qrUrl = await generateQRFile(from, cmd.amount, cmd.memo)
      const amountText = cmd.amount ? `$${cmd.amount}` : 'any amount'
      return `📱 *Payment QR Code*\n\nScan to pay ${amountText}${cmd.memo ? ` for "${cmd.memo}"` : ''}\n\n🔗 ${qrUrl}`
    }

    case 'HISTORY': {
      const txns = getRecentTransactions(from, 5)
      if (txns.length === 0) {
        return '📋 No transaction history yet'
      }
      const lines = txns.map(txn => {
        const date = new Date(txn.created_at * 1000).toLocaleDateString()
        const icon = txn.type === 'send' ? '📤' : '📥'
        const link = txn.hash ? `\n   └ ${getTxLink(txn.hash)}` : ''
        return `${icon} *$${txn.amount.toFixed(2)}* → ${txn.recipient || 'unknown'} (${date})${link}`
      })
      return `📋 *Recent Transactions:*\n\n${lines.join('\n\n')}`
    }

    case 'ADD': {
      addContact(from, cmd.nickname, cmd.phone)
      return `✅ Saved contact *@${cmd.nickname}* → ${cmd.phone}`
    }

    case 'LIMIT': {
      setSpendingLimit(from, cmd.amount)
      return `✅ Daily spending limit set to *$${cmd.amount.toFixed(2)}*`
    }

    case 'BAL': {
      const user = await getOrCreateUser(from)
      const balances = await getAllBalances(user.address)
      const balanceLines = Object.entries(balances)
        .map(([token, bal]) => `• ${token}: *$${parseFloat(bal).toFixed(2)}*`)
        .join('\n')
      return `💰 *Your Balances:*\n${balanceLines}\n\n📍 \`${user.address.slice(0, 12)}...\`\n🔗 https://explore.tempo.xyz/address/${user.address}`
    }

    case 'SEND': {
      if (!canSpend(from, cmd.amount)) {
        return generateFailedReceiptText(cmd.amount, cmd.recipient, 'Daily spending limit exceeded')
      }

      const recipientPhone = resolveRecipient(cmd.recipient)
      
      try {
        const [sender, recipient] = await Promise.all([
          getOrCreateUser(from),
          getOrCreateUser(recipientPhone)
        ])
        
        // Check sender has sufficient balance
        const balances = await getAllBalances(sender.address)
        const balance = parseFloat(balances.AlphaUSD)
        if (balance < cmd.amount) {
          return generateFailedReceiptText(cmd.amount, recipientPhone, `Insufficient balance. You have $${balance.toFixed(2)}. Use FUND $${cmd.amount} to add test funds.`)
        }
        
        let hash: string
        const currency = 'AlphaUSD'
        
        hash = await sendPayment(sender.walletId, sender.address, recipient.address, cmd.amount, cmd.memo)
        
        recordTransaction(from, 'send', cmd.amount, recipientPhone, cmd.memo || null, hash)
        updateSpentAmount(from, cmd.amount)
        
        return generateReceiptText('send', cmd.amount, recipientPhone, hash, cmd.memo, currency)
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Transaction failed'
        return generateFailedReceiptText(cmd.amount, recipientPhone, error)
      }
    }

    case 'SPLIT': {
      if (!canSpend(from, cmd.amount)) {
        return generateFailedReceiptText(cmd.amount, `${cmd.recipients.length} people`, 'Daily spending limit exceeded')
      }

      try {
        const resolvedRecipients = cmd.recipients.map(resolveRecipient)
        const sender = await getOrCreateUser(from)
        
        // Check sender has sufficient balance
        const balances = await getAllBalances(sender.address)
        const balance = parseFloat(balances.AlphaUSD)
        if (balance < cmd.amount) {
          return generateFailedReceiptText(cmd.amount, `${cmd.recipients.length} people`, `Insufficient balance. You have $${balance.toFixed(2)}. Use FUND $${cmd.amount} to add test funds.`)
        }
        
        const recipients = await Promise.all(resolvedRecipients.map(p => getOrCreateUser(p)))
        const addresses = recipients.map(r => r.address)
        const each = cmd.amount / cmd.recipients.length
        const hash = await sendBatchPayment(sender.walletId, sender.address, addresses, each, cmd.memo)
        
        resolvedRecipients.forEach(phone => {
          recordTransaction(from, 'send', each, phone, cmd.memo || null, hash)
        })
        updateSpentAmount(from, cmd.amount)
        
        return generateReceiptText('split', cmd.amount, `${cmd.recipients.length} people ($${each.toFixed(2)} each)`, hash, cmd.memo)
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Transaction failed'
        return generateFailedReceiptText(cmd.amount, `${cmd.recipients.length} people`, error)
      }
    }

    case 'REQUEST': {
      const fromPhone = resolveRecipient(cmd.from)
      const id = createRequest(from, fromPhone, cmd.amount, cmd.memo)
      await sendNotification(
        fromPhone,
        `💸 ${from} requested *$${cmd.amount}*${cmd.memo ? ` for "${cmd.memo}"` : ''}.\n\nReply *PAY ${id}* to send.`
      )
      return `📤 Requested *$${cmd.amount}* from ${fromPhone}.\nRequest ID: *#${id}*`
    }

    case 'PAY': {
      const req = getRequest(cmd.requestId)
      if (!req) throw new Error(`Request #${cmd.requestId} not found`)
      if (req.status !== 'pending') throw new Error('Already paid')
      if (req.to_phone !== from) throw new Error('This request is not for you')

      if (!canSpend(from, req.amount)) {
        return generateFailedReceiptText(req.amount, req.from_phone, 'Daily spending limit exceeded')
      }

      try {
        const [payer, requester] = await Promise.all([
          getOrCreateUser(from),
          getOrCreateUser(req.from_phone)
        ])
        
        // Check payer has sufficient balance
        const balances = await getAllBalances(payer.address)
        const balance = parseFloat(balances.AlphaUSD)
        if (balance < req.amount) {
          return generateFailedReceiptText(req.amount, req.from_phone, `Insufficient balance. You have $${balance.toFixed(2)}. Use FUND $${req.amount} to add test funds.`)
        }
        
        const hash = await sendPayment(payer.walletId, payer.address, requester.address, req.amount, req.memo)
        markRequestPaid(cmd.requestId)

        recordTransaction(from, 'send', req.amount, req.from_phone, req.memo || null, hash)
        updateSpentAmount(from, req.amount)

        await sendNotification(req.from_phone, `✅ ${from} paid your *$${req.amount}* request!\n\n🔗 ${getTxLink(hash)}`)
        
        return generateReceiptText('send', req.amount, req.from_phone, hash, req.memo || undefined)
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Transaction failed'
        return generateFailedReceiptText(req.amount, req.from_phone, error)
      }
    }
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}
