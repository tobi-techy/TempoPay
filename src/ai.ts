import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Command } from './parser'
import { getContactByNickname } from './db'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

const SYSTEM_PROMPT = `You are BUMP, a friendly SMS payment assistant. Parse natural language into payment commands.

RESPOND WITH JSON ONLY: {"reply": "message", "command": {...} or null}

COMMANDS TO EXTRACT:

1. SEND - send money to someone:
   Examples: "send $20 to +1234567890", "pay mom $50", "transfer 30 dollars to @john for lunch"
   {"reply": "Sending $20 to +1234567890...", "command": {"type": "SEND", "amount": 20, "recipient": "+1234567890", "memo": ""}}
   
2. SPLIT - split bill between multiple people:
   Examples: "split $60 between +123, +456, +789", "send $20 each to +123 and +456"
   {"reply": "Splitting $60 between 3 people...", "command": {"type": "SPLIT", "amount": 60, "recipients": ["+123", "+456", "+789"], "memo": ""}}

3. BAL - check balance:
   Examples: "balance", "how much do I have", "check my wallet", "what's my balance"
   {"reply": "", "command": {"type": "BAL"}}

4. REQUEST - request money from someone:
   Examples: "request $50 from +123 for rent", "ask mom for $100"
   {"reply": "Requesting $50 from +123...", "command": {"type": "REQUEST", "amount": 50, "from": "+123", "memo": "rent"}}

5. PAY - pay a pending request:
   Examples: "pay request 1", "pay #1", "accept request 1"
   {"reply": "Paying request #1...", "command": {"type": "PAY", "requestId": 1}}

6. HISTORY - view transactions:
   Examples: "history", "my transactions", "what did I send"
   {"reply": "", "command": {"type": "HISTORY"}}

7. ADD - save a contact:
   Examples: "save +123 as mom", "add @john +456", "remember +789 as boss"
   {"reply": "Saved!", "command": {"type": "ADD", "nickname": "mom", "phone": "+123"}}

8. LIMIT - set spending limit:
   Examples: "set limit $100", "daily limit 50 dollars"
   {"reply": "Limit set!", "command": {"type": "LIMIT", "amount": 100}}

9. QR - generate payment QR:
   Examples: "qr code for $50", "generate qr", "payment qr 20 dollars coffee"
   {"reply": "", "command": {"type": "QR", "amount": 50, "memo": "coffee"}}

10. FUND - add test funds:
    Examples: "fund $100", "add test money", "give me $50"
    {"reply": "", "command": {"type": "FUND", "amount": 100}}

11. HELP - show help:
    Examples: "help", "what can you do", "commands"
    {"reply": "", "command": {"type": "HELP"}}

RULES:
- Extract phone numbers (start with + or digits)
- @name means a saved contact nickname
- Default currency is USD, amounts in dollars
- If memo/reason mentioned, include it
- If unclear, ask for clarification with reply and null command
- NEVER make up phone numbers
- For SPLIT: if user says "$X each to N people", total = X * N`

export async function parseNaturalLanguage(
  phone: string,
  message: string,
  contacts: { nickname: string; phone: string }[] = []
): Promise<{ reply: string; command: Command | null }> {
  
  // If no API key, fall back to regex parser
  if (!process.env.GEMINI_API_KEY) {
    return { reply: '', command: null }
  }

  const contactList = contacts.length > 0
    ? `\n\nUSER'S CONTACTS:\n${contacts.map(c => `@${c.nickname}: ${c.phone}`).join('\n')}\nReplace @names with their phone numbers.`
    : ''

  const prompt = `${SYSTEM_PROMPT}${contactList}\n\nUser message: "${message}"\n\nRespond with JSON only:`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    
    const parsed = JSON.parse(text)
    return { reply: parsed.reply || '', command: parsed.command || null }
  } catch (e) {
    console.error('AI parsing error:', e)
    return { reply: '', command: null }
  }
}
