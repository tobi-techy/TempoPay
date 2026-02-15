# BUMP 💸

> **Send money via SMS — no app, no download, no crypto knowledge required.**

Built for the [Canteen x Tempo Hackathon](https://tempo.xyz) | Track 1: Privy Wallets

![BUMP Demo](https://img.shields.io/badge/Status-Live-brightgreen) ![Tempo](https://img.shields.io/badge/Chain-Tempo-blue) ![Privy](https://img.shields.io/badge/Wallets-Privy-purple)

## 🎯 Problem

2 billion people are unbanked. They have phones but no access to financial services. Crypto apps require downloads, seed phrases, and technical knowledge — barriers that exclude the people who need financial access most.

## 💡 Solution

**BUMP** lets anyone send money by texting simple commands. No app download. No seed phrase. No crypto jargon. Just text.

```
SEND $20 to +2348012345678 lunch
```

That's it. The recipient gets an SMS notification and can check their balance or send money forward — all via text.

## ✨ Features

| Command | Description | Example |
|---------|-------------|---------|
| `SEND` | Send payment to any phone | `SEND $20 to +1234567890 dinner` |
| `BAL` | Check your balance | `BAL` |
| `SPLIT` | Split bill with multiple people | `SPLIT $60 to +123,+456,+789` |
| `REQUEST` | Request payment from someone | `REQUEST $50 from +123 rent` |
| `PAY` | Pay a pending request | `PAY 1` |
| `HISTORY` | View recent transactions | `HISTORY` |
| `ADD` | Save contact nickname | `ADD @mom +1234567890` |
| `LIMIT` | Set daily spending limit | `LIMIT $100` |
| `QR` | Generate payment QR code | `QR $50 coffee` |
| `FUND` | Add test funds (testnet) | `FUND $100` |
| `HELP` | Show all commands | `HELP` |

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Twilio    │     │  BUMP   │     │   Tempo     │
│  (SMS)      │────▶│  Webhook    │────▶│   Server    │────▶│ Blockchain  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │   Privy     │
                                        │  Wallets    │
                                        └─────────────┘
```

### How It Works

1. **User sends SMS** → Twilio receives and forwards to our webhook
2. **Command parsed** → Natural language commands converted to actions
3. **Wallet created** → Privy creates embedded wallet for new users (no seed phrase!)
4. **Transaction signed** → Server signs via Privy authorization keys
5. **Sent on Tempo** → Gasless transaction on Tempo blockchain
6. **Receipt sent** → User gets SMS confirmation with explorer link

## 🔧 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | **Bun** | Fast TypeScript runtime |
| Server | **Express** | HTTP webhook handler |
| SMS/WhatsApp | **Twilio** | Message gateway |
| Wallets | **Privy** | Embedded wallet infrastructure |
| Blockchain | **Tempo** | Gasless stablecoin transfers |
| Database | **SQLite** | Wallet & transaction persistence |
| Client | **viem** | Blockchain interactions |

## 🎮 Privy Integration (Track 1)

BUMP uses Privy's server-side wallet infrastructure:

- **Embedded Wallets**: Users get wallets automatically — no seed phrases
- **Authorization Keys**: Server signs transactions with key quorum
- **Policies**: Restrict transfers to approved token contracts only
- **No User Auth Required**: Phone number = identity

```typescript
// Create wallet for new user
const wallet = await privyRequest('/wallets', 'POST', {
  chain_type: 'ethereum',
  owner_id: KEY_QUORUM_ID,      // Server can sign
  policy_ids: [POLICY_ID]        // Only AlphaUSD/BetaUSD transfers
})
```

## ⚡ Tempo Features Used

| Feature | Implementation |
|---------|----------------|
| **Gasless Transactions** | Users don't pay gas — Tempo handles it |
| **AlphaUSD Stablecoin** | Primary currency for transfers |
| **Fast Finality** | Transactions confirm in seconds |
| **Explorer Links** | Every receipt includes verification link |

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) installed
- Twilio account with phone number
- Privy account with API keys
- Tempo testnet wallet with AlphaUSD

### Installation

```bash
git clone https://github.com/tobi-techy/BUMP.git
cd BUMP
bun install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Privy
PRIVY_APP_ID=your_app_id
PRIVY_APP_SECRET=your_secret
PRIVY_AUTHORIZATION_KEY_ID=your_key_id
PRIVY_AUTHORIZATION_PRIVATE_KEY=wallet-auth:your_private_key

# Sponsor wallet (funds test users)
SPONSOR_PRIVATE_KEY=0x...
```

### Privy Setup

1. Create app at [dashboard.privy.io](https://dashboard.privy.io)
2. Go to **Wallet Infrastructure** → **Authorization** → Create key
3. Go to **Policies** → Create policy for Ethereum with rules:
   - Allow `eth_sendTransaction` to `0x20c0000000000000000000000000000000000001` (AlphaUSD)
   - Allow `eth_sendTransaction` to `0x20c0000000000000000000000000000000000002` (BetaUSD)
4. Create **Key Quorum** with your authorization key's public key
5. Note the Policy ID and Key Quorum ID for your code

### Run

```bash
bun run index.ts
```

### Expose for Twilio (development)

```bash
ngrok http 3000
# Copy the https URL
```

Set Twilio webhook: `https://your-ngrok-url.ngrok.io/sms`

## 📱 Demo Flow

```
You: FUND $50
Bot: ✅ Added $50 test funds to your wallet!
     🔗 https://explore.tempo.xyz/tx/0x...

You: SEND $10 to +2348012345678 lunch
Bot: ━━━━━━━━━━━━━━━━━━━━
     📄 BUMP Receipt
     ━━━━━━━━━━━━━━━━━━━━
     💰 Amount: $10.00 AlphaUSD
     👤 To: +2348012345678
     📝 Memo: "lunch"
     ✅ Status: Confirmed
     🔗 https://explore.tempo.xyz/tx/0x...
     ━━━━━━━━━━━━━━━━━━━━

You: BAL
Bot: 💰 Your Balances:
     • AlphaUSD: $39.98
     • BetaUSD: $0.00
     📍 0x143AeD4D1c...
     🔗 https://explore.tempo.xyz/address/0x...
```

## 🌍 Use Cases

- **Remittances**: Send money to family abroad via text
- **Merchant Payments**: Pay street vendors without apps
- **Bill Splitting**: Split dinner with friends instantly
- **Allowances**: Parents send money to kids' phones
- **Peer Lending**: Request and track informal loans

## 📁 Project Structure

```
bump/
├── index.ts          # Express server & routes
├── src/
│   ├── sms.ts        # Twilio webhook handler
│   ├── parser.ts     # Command parsing
│   ├── commands.ts   # Command execution
│   ├── privy.ts      # Wallet management
│   ├── tempo.ts      # Blockchain operations
│   ├── db.ts         # SQLite persistence
│   └── utils.ts      # QR codes, receipts
├── public/           # Static files (QR codes)
└── .env.example      # Environment template
```

## 🔒 Security

- **No seed phrases exposed** — Privy manages keys securely
- **Policy restrictions** — Only approved token transfers allowed
- **Authorization signatures** — Server proves identity for each request
- **Spending limits** — Users can set daily caps
- **Phone verification** — Twilio validates phone numbers

## 🛣️ Roadmap

- [ ] WhatsApp Business API integration
- [ ] USSD support for feature phones
- [ ] Multi-currency support (BetaUSD, etc.)
- [ ] Recurring payments
- [ ] Merchant dashboard
- [ ] KYC integration for higher limits

## 👥 Team

Built by [@tobi-techy](https://github.com/tobi-techy) for Canteen x Tempo Hackathon 2026

## 📄 License

MIT

---

**BUMP** — Banking the unbanked, one text at a time. 📱💸
