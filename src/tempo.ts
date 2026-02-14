import { createClient, http, publicActions, walletActions, parseUnits, formatUnits, stringToHex, pad, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'

export const ALPHA_USD = '0x20c0000000000000000000000000000000000001' as const
const DECIMALS = 6

// TIP-20 ABI (minimal)
const tip20Abi = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const

const account = privateKeyToAccount(process.env.SPONSOR_PRIVATE_KEY as `0x${string}`)

export const client = createClient({
  account,
  chain: tempoModerato,
  transport: http()
}).extend(publicActions).extend(walletActions)

export async function sendPayment(to: string, amount: number, memo: string) {
  const hash = await client.sendTransaction({
    to: ALPHA_USD,
    data: encodeFunctionData({
      abi: tip20Abi,
      functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(amount.toString(), DECIMALS)]
    })
  })
  return hash
}

export async function sendBatchPayment(recipients: string[], amountEach: number, memo: string) {
  const calls = recipients.map(to => ({
    to: ALPHA_USD as `0x${string}`,
    data: encodeFunctionData({
      abi: tip20Abi,
      functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(amountEach.toString(), DECIMALS)]
    })
  }))

  const hash = await client.sendTransaction({ calls } as any)
  return hash
}

export async function getBalance(address: string): Promise<string> {
  const balance = await client.readContract({
    address: ALPHA_USD,
    abi: tip20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  })
  return formatUnits(balance, DECIMALS)
}
