import 'dotenv/config'
import express from 'express'
import { handleSms } from './src/sms'

const app = express()
app.use(express.urlencoded({ extended: true }))

app.post('/sms', handleSms)

app.get('/health', (_, res) => res.send('OK'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`TempoPay running on port ${PORT}`))
