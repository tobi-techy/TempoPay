import { createClient, http, publicActions, walletActions, parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { PrivyClient } from '@privy-io/server-auth'

export const TOKENS = {
  AlphaUSD: '0x20c0000000000000000000000000000000000001',
  BetaUSD: '0x20c0000000000000000000000000000000000002',
} as const

export const ALPHA_USD = TOKENS.AlphaUSD
const DECIMALS = 6

const tip20Abi = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const sponsorAccount = privateKeyToAccount(process.env.SPONSOR_PRIVATE_KEY as `0x${string}`)

export const publicClient = createClient({
  chain: tempoModerato,
  transport: http()
}).extend(publicActions)

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!
    }
  }
)

export async function sendPayment(walletId: string, _fromAddress: string, to: string, amount: number, _memo: string) {
  const data = encodeFunctionData({
    abi: tip20Abi,
    functionName: 'transfer',
    args: [to as `0x${string}`, parseUnits(amount.toString(), DECIMALS)]
  })
  
  const result = await privy.walletApi.ethereum.sendTransaction({
    walletId,
    caip2: 'eip155:42431',
    transaction: { to: ALPHA_USD, data, value: '0x0' }
  })
  
  return result.hash
}

export async function sendBatchPayment(walletId: string, fromAddress: string, recipients: string[], amountEach: number, memo: string) {
  const hashes: string[] = []
  for (const to of recipients) {
    hashes.push(await sendPayment(walletId, fromAddress, to, amountEach, memo))
  }
  return hashes[0]
}

export async function getBalance(address: string): Promise<string> {
  const balance = await publicClient.readContract({
    address: ALPHA_USD,
    abi: tip20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  })
  return formatUnits(balance, DECIMALS)
}

export async function getAllBalances(address: string): Promise<Record<string, string>> {
  const [alpha, beta] = await Promise.all([
    publicClient.readContract({ address: TOKENS.AlphaUSD, abi: tip20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }),
    publicClient.readContract({ address: TOKENS.BetaUSD, abi: tip20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }),
  ])
  return { AlphaUSD: formatUnits(alpha, DECIMALS), BetaUSD: formatUnits(beta, DECIMALS) }
}

export async function fundUserWallet(toAddress: string, amount: number) {
  const sponsorClient = createClient({
    account: sponsorAccount,
    chain: tempoModerato,
    transport: http()
  }).extend(publicActions).extend(walletActions)
  
  return sponsorClient.sendTransaction({
    to: ALPHA_USD,
    data: encodeFunctionData({
      abi: tip20Abi,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, parseUnits(amount.toString(), DECIMALS)]
    })
  })
}

// Fund gas for user wallet
export async function fundGas(toAddress: string) {
  const sponsorClient = createClient({
    account: sponsorAccount,
    chain: tempoModerato,
    transport: http()
  }).extend(publicActions).extend(walletActions)
  
  // Send 0.01 native token for gas
  return sponsorClient.sendTransaction({
    to: toAddress as `0x${string}`,
    value: parseUnits('0.01', 18)
  })
}
