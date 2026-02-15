import QRCode from 'qrcode'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

const PUBLIC_DIR = './public/qr'
const BASE_URL = process.env.BASE_URL || 'https://your-ngrok-url.ngrok-free.dev'

// Ensure QR directory exists
if (!existsSync(PUBLIC_DIR)) {
  await mkdir(PUBLIC_DIR, { recursive: true })
}

export const EXPLORER_URL = 'https://explore.tempo.xyz/tx'

export function getTxLink(hash: string): string {
  return `${EXPLORER_URL}/${hash}`
}

export function formatTxResponse(hash: string, success: boolean): string {
  const link = getTxLink(hash)
  if (success) {
    return `🔗 View: ${link}`
  }
  return `❌ Failed TX: ${link}`
}

export async function generatePaymentQR(
  toPhone: string,
  amount?: number,
  memo?: string
): Promise<string> {
  // Create payment deep link
  const params = new URLSearchParams({ to: toPhone })
  if (amount) params.set('amount', amount.toString())
  if (memo) params.set('memo', memo)
  
  const paymentLink = `${BASE_URL}/pay?${params.toString()}`
  
  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(paymentLink, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  })
  
  return qrDataUrl
}

export async function generateQRFile(
  toPhone: string,
  amount?: number,
  memo?: string
): Promise<string> {
  const filename = `qr_${Date.now()}.png`
  const filepath = `${PUBLIC_DIR}/${filename}`
  
  const params = new URLSearchParams({ to: toPhone })
  if (amount) params.set('amount', amount.toString())
  if (memo) params.set('memo', memo)
  
  const paymentLink = `${BASE_URL}/pay?${params.toString()}`
  
  await QRCode.toFile(filepath, paymentLink, {
    width: 300,
    margin: 2
  })
  
  return `${BASE_URL}/qr/${filename}`
}

export function generateReceiptText(
  type: 'send' | 'receive' | 'split',
  amount: number,
  recipient: string,
  hash: string,
  memo?: string,
  currency = 'AlphaUSD'
): string {
  const txLink = getTxLink(hash)
  const timestamp = new Date().toLocaleString()
  
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📄 *TempoPay Receipt*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `💰 Amount: *$${amount.toFixed(2)} ${currency}*`,
    type === 'split' ? `👥 Split to: ${recipient}` : `👤 To: ${recipient}`,
    memo ? `📝 Memo: "${memo}"` : null,
    ``,
    `🕐 ${timestamp}`,
    `✅ Status: Confirmed`,
    ``,
    `🔗 ${txLink}`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean)
  
  return lines.join('\n')
}

export function generateFailedReceiptText(
  amount: number,
  recipient: string,
  error: string
): string {
  const timestamp = new Date().toLocaleString()
  
  return [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📄 *TempoPay Receipt*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `💰 Amount: *$${amount.toFixed(2)}*`,
    `👤 To: ${recipient}`,
    ``,
    `🕐 ${timestamp}`,
    `❌ Status: Failed`,
    `⚠️ Error: ${error}`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n')
}
