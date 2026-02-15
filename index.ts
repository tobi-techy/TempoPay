import 'dotenv/config'
import express from 'express'
import { handleSms } from './src/sms'
import { getOrCreateUser, getWalletAddress } from './src/privy'

const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Serve QR codes
app.use('/qr', express.static('public/qr'))

// SMS/WhatsApp webhook
app.post('/sms', handleSms)

// Payment page (for QR codes)
app.get('/pay', async (req, res) => {
  const { to, amount, memo } = req.query
  
  if (!to) {
    return res.status(400).send('Missing recipient')
  }
  
  // Simple payment page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BUMP</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
        h1 { color: #333; }
        .amount { font-size: 48px; font-weight: bold; color: #10b981; }
        .memo { color: #666; margin: 10px 0; }
        .info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .btn { background: #10b981; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 18px; cursor: pointer; width: 100%; }
      </style>
    </head>
    <body>
      <h1>💸 BUMP</h1>
      <div class="amount">$${amount || '0.00'}</div>
      ${memo ? `<div class="memo">For: ${memo}</div>` : ''}
      <div class="info">
        <strong>To:</strong> ${to}<br>
        <small>Payment via Tempo blockchain</small>
      </div>
      <p>Text this to pay:</p>
      <code>SEND $${amount || '[amount]'} to ${to}${memo ? ` ${memo}` : ''}</code>
      <p style="margin-top: 20px; color: #666; font-size: 14px;">
        Send to your Bump number to complete payment.
      </p>
    </body>
    </html>
  `)
})

app.get('/health', (_, res) => res.send('OK'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`BUMP running on port ${PORT}`))
