import type { Command } from './parser'
import { getOrCreateUser, getWalletAddress, getWalletId } from './privy'
import { sendPayment, sendBatchPayment, getAllBalances, fundUserWallet, TOKENS } from './tempo'
import { 
  createRequest, getRequest, markRequestPaid, 
  recordTransaction, getRecentTransactions,
  addContact, getContactByNickname,
  setSpendingLimit, canSpend, updateSpentAmount,
  setTag, getWalletByTag, getTag
} from './db'
import { getTxLink, generateReceiptText, generateFailedReceiptText, generateQRFile } from './utils'
import twilio from 'twilio'

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER!
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || `whatsapp:${TWILIO_PHONE}`

const HELP_TEXT = `💸 *TempoPay* - Send money via text!

*Commands:*
• SEND $20 to +1234567890 lunch
• SEND $20 to @mom _(saved contact)_
• SEND $20 to $john _(payment tag)_
• SPLIT $60 to +123,+456,+789 dinner
• REQUEST $50 from +1234567890 rent
• PAY 1 _(pay request #1)_
• BAL _(check balance)_
• HISTORY _(recent payments)_
• TAG myname _(set your $tag)_
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

  const resolveRecipient = (recipient: string): string | { address: string; tag: string } => {
    // $tag - payment tag
    if (recipient.startsWith('$')) {
      const tag = recipient.slice(1)
      const wallet = getWalletByTag(tag)
      if (!wallet) throw new Error(`Tag $${tag} not found`)
      return { address: wallet.address, tag }
    }
    // @nickname - saved contact
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
      const user = await getOrCreateUser(from)
      const hash = await fundUserWallet(user.address, cmd.amount)
      return `✅ Added *$${cmd.amount}* test funds to your wallet!\n🔗 ${getTxLink(hash)}`
    }

    case 'TAG': {
      await getOrCreateUser(from) // Ensure wallet exists
      const tag = cmd.tag.toLowerCase()
      if (tag.length < 3 || tag.length > 15) {
        return '❌ Tag must be 3-15 characters'
      }
      if (!/^[a-z0-9_]+$/.test(tag)) {
        return '❌ Tag can only contain letters, numbers, and underscores'
      }
      const existing = getWalletByTag(tag)
      if (existing) {
        return `❌ Tag $${tag} is already taken`
      }
      setTag(from, tag)
      return `✅ Your tag is now *$${tag}*\n\nAnyone can send you money with:\nSEND $20 to $${tag}`
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
      const tag = getTag(from)
      const tagLine = tag ? `\n🏷️ Tag: *$${tag}*` : '\n💡 Set a tag: TAG yourname'
      return `💰 *Your Balances:*\n${balanceLines}${tagLine}\n\n📍 \`${user.address.slice(0, 12)}...\`\n🔗 https://explore.tempo.xyz/address/${user.address}`
    }

    case 'SEND': {
      if (!canSpend(from, cmd.amount)) {
        return generateFailedReceiptText(cmd.amount, cmd.recipient, 'Daily spending limit exceeded')
      }

      const resolved = resolveRecipient(cmd.recipient)
      
      try {
        const sender = await getOrCreateUser(from)
        
        let recipientAddress: string
        let recipientDisplay: string
        
        if (typeof resolved === 'object') {
          // Tag recipient - already have address
          recipientAddress = resolved.address
          recipientDisplay = `$${resolved.tag}`
        } else {
          // Phone recipient - get/create wallet
          const recipient = await getOrCreateUser(resolved)
          recipientAddress = recipient.address
          recipientDisplay = resolved
        }
        
        // Check sender has sufficient balance
        const balances = await getAllBalances(sender.address)
        const balance = parseFloat(balances.AlphaUSD as string)
        if (balance < cmd.amount) {
          return generateFailedReceiptText(cmd.amount, recipientDisplay, `Insufficient balance. You have $${balance.toFixed(2)}. Use FUND $${cmd.amount} to add test funds.`)
        }
        
        const hash = await sendPayment(sender.walletId, sender.address, recipientAddress, cmd.amount, cmd.memo)
        
        recordTransaction(from, 'send', cmd.amount, recipientDisplay, cmd.memo || null, hash)
        updateSpentAmount(from, cmd.amount)
        
        return generateReceiptText('send', cmd.amount, recipientDisplay, hash, cmd.memo, 'AlphaUSD')
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Transaction failed'
        return generateFailedReceiptText(cmd.amount, recipientDisplay, error)
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
        const balance = parseFloat(balances.AlphaUSD as string)
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
