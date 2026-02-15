import type { Request, Response } from 'express'
import twilio from 'twilio'
import { parseCommand } from './parser'
import { handleCommand } from './commands'
import { parseNaturalLanguage } from './ai'
import { listContacts } from './db'

const { MessagingResponse } = twilio.twiml

export async function handleSms(req: Request, res: Response) {
  const from = req.body.From as string
  const body = (req.body.Body as string || '').trim()
  
  const isWhatsApp = from.startsWith('whatsapp:')
  const phoneNumber = isWhatsApp ? from.replace('whatsapp:', '') : from
  
  const twiml = new MessagingResponse()
  
  try {
    // Try AI parsing first
    const contacts = listContacts(phoneNumber).map(c => ({ nickname: c.nickname, phone: c.contact_phone }))
    const ai = await parseNaturalLanguage(phoneNumber, body, contacts)
    
    let parsed = ai.command
    let aiReply = ai.reply
    
    // Fall back to regex parser if AI didn't understand
    if (!parsed) {
      parsed = parseCommand(body)
      aiReply = ''
    }
    
    const response = await handleCommand(phoneNumber, parsed, isWhatsApp)
    
    // Prepend AI reply if it added context
    const finalResponse = aiReply ? `${aiReply}\n\n${response}` : response
    twiml.message(finalResponse)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong'
    twiml.message(`❌ ${msg}`)
  }
  
  res.type('text/xml').send(twiml.toString())
}
