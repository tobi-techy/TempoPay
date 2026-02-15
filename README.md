# TempoPay 💸

SMS & WhatsApp payment system on [Tempo](https://tempo.xyz) blockchain. Send money via text — no app required.

## Features

- 📱 **SMS & WhatsApp** - Works on both channels
- 💸 **SEND** - Single payments with memos
- 💱 **FX Conversion** - Swap stablecoins via Tempo DEX
- 👥 **SPLIT** - Atomic batch payments (Tempo batch TX)
- 📤 **REQUEST** - Payment requests via message
- ⚡ **Parallel Processing** - Concurrent handling with 2D nonces

## Commands

```
SEND $20 to +1234567890 lunch       → single payment
SEND $20 BETA to +1234567890        → FX swap (AlphaUSD → BetaUSD)
SPLIT $60 to +123,+456,+789 dinner  → atomic batch (3 × $20)
REQUEST $50 from +1234567890 rent   → payment request
PAY 1                                → pay request #1
BAL                                  → check all balances
HELP                                 → list commands
```

## Tech Stack

- **Bun** + Express
- **Twilio** - SMS & WhatsApp webhooks
- **Privy** - Server-side wallet management
- **viem** - Tempo blockchain client

## Tempo Features Used

| Feature | Use Case |
|---------|----------|
| Batch transactions | SPLIT - atomic multi-transfer |
| Parallel nonces | Concurrent message processing |
| Stablecoin DEX | FX conversion (SEND $X BETA) |
| Transfer memos | Payment descriptions on-chain |
| Stablecoin fees | Pay fees in AlphaUSD |

## Setup

```bash
git clone https://github.com/tobi-techy/TempoPay.git
cd TempoPay
bun install
cp .env.example .env
# Edit .env with your credentials
bun run index.ts
```

## Twilio Configuration

### SMS
1. Buy a phone number in Twilio Console
2. Set webhook: `https://your-url/sms` (POST)

### WhatsApp
1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Join sandbox: Send "join <sandbox-word>" to +14155238886
3. Set webhook: `https://your-url/sms` (POST) - same endpoint!

## Environment Variables

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1234567890
WHATSAPP_NUMBER=whatsapp:+14155238886
PRIVY_APP_ID=
PRIVY_APP_SECRET=
SPONSOR_PRIVATE_KEY=
```

## Architecture

```
User (SMS/WhatsApp) → Twilio → Express → Privy (wallets) → Tempo (blockchain)
                                              ↓
                                    Tempo DEX (FX swaps)
```

## License

MIT
