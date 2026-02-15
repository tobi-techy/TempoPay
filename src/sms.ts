import type { Request, Response } from 'express'
import twilio from 'twilio'
import { parseCommand } from './parser'
import { handleCommand } from './commands'

const { MessagingResponse } = twilio.twiml

export async function handleSms(req: Request, res: Response) {
  const from = req.body.From as string
  const body = (req.body.Body as string || '').trim()
  
  // Detect if WhatsApp (format: whatsapp:+1234567890)
  const isWhatsApp = from.startsWith('whatsapp:')
  const phoneNumber = isWhatsApp ? from.replace('whatsapp:', '') : from
  
  const twiml = new MessagingResponse()
  
  try {
    const parsed = parseCommand(body)
    const response = await handleCommand(phoneNumber, parsed, isWhatsApp)
    twiml.message(response)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong'
    twiml.message(`❌ ${msg}`)
  }
  
  res.type('text/xml').send(twiml.toString())
}
