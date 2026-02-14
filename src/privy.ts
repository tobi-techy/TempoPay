import { PrivyClient } from '@privy-io/server-auth'

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
)

export async function getOrCreateUser(phone: string) {
  // Try to find existing user
  const existing = await privy.getUserByPhone({ number: phone }).catch(() => null)
  if (existing) return existing

  // Create new user with embedded wallet
  return privy.createUser({
    linkedAccounts: [{ type: 'phone', number: phone }],
    createEthereumWallet: true
  })
}

export function getWalletAddress(user: Awaited<ReturnType<typeof getOrCreateUser>>): string {
  const wallet = user.linkedAccounts.find(
    (a): a is Extract<typeof a, { type: 'wallet' }> => 
      a.type === 'wallet' && a.chainType === 'ethereum'
  )
  if (!wallet?.address) throw new Error('No wallet found')
  return wallet.address
}
