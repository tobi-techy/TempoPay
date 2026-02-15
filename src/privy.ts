import { saveWallet, getWallet } from './db'

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!
const POLICY_ID = 'nqzlbcabb02v3payjbt5c8v5'
const KEY_QUORUM_ID = 'comqvuhhyh3z554rtmpeadjt'

const authHeader = 'Basic ' + Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')

async function privyRequest(endpoint: string, method = 'GET', body?: object) {
  const res = await fetch(`https://api.privy.io/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': authHeader,
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Privy API error: ${err}`)
  }
  return res.json()
}

export interface UserWithWallet {
  id: string
  walletId: string
  address: string
  isNew: boolean
}

export async function getOrCreateUser(phone: string): Promise<UserWithWallet> {
  // Check database first
  const existing = getWallet(phone)
  if (existing) {
    return { id: phone, walletId: existing.wallet_id, address: existing.address, isNew: false }
  }
  
  // Create new wallet
  const wallet = await privyRequest('/wallets', 'POST', {
    chain_type: 'ethereum',
    owner_id: KEY_QUORUM_ID,
    policy_ids: [POLICY_ID]
  })
  
  // Save to database
  saveWallet(phone, wallet.id, wallet.address)
  
  return { id: phone, walletId: wallet.id, address: wallet.address, isNew: true }
}

export function getWalletAddress(user: UserWithWallet): string {
  return user.address
}

export function getWalletId(user: UserWithWallet): string {
  return user.walletId
}
