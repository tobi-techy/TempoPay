const PRIVY_APP_ID = process.env.PRIVY_APP_ID!
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!

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

export async function getOrCreateUser(phone: string) {
  // Try to find existing user by phone
  try {
    const user = await privyRequest('/users/phone/number', 'POST', { number: phone })
    return user
  } catch {
    // User not found, create new one with wallet
    const user = await privyRequest('/users', 'POST', {
      linked_accounts: [{ type: 'phone', number: phone }],
      create_ethereum_wallet: true
    })
    return user
  }
}

export function getWalletAddress(user: any): string {
  const wallet = user.linked_accounts?.find(
    (a: any) => a.type === 'wallet' && a.chain_type === 'ethereum'
  )
  if (!wallet?.address) throw new Error('No wallet found for user')
  return wallet.address
}
