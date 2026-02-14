# TempoPay 💸

SMS-based P2P payment system on [Tempo](https://tempo.xyz) blockchain. Send money via text message — no app required.

## Features

- **SEND** - Single payments with memos
- **SPLIT** - Atomic batch payments (Tempo batch transactions)
- **REQUEST** - Payment requests via SMS
- **BAL** - Check balance
- **Parallel Processing** - Concurrent SMS handling with 2D nonces

## Commands

```
SEND $20 to +1234567890 lunch       → single payment
SPLIT $60 to +123,+456,+789 dinner  → atomic batch (3 × $20)
REQUEST $50 from +1234567890 rent   → payment request
PAY 1                                → pay request #1
BAL                                  → check balance
HELP                                 → list commands
```

## Tech Stack

- **Bun** + Express
- **Twilio** - SMS webhooks
- **Privy** - Server-side wallet management
- **viem** - Tempo blockchain client
- **SQLite** - Payment requests

## Tempo Features Used

| Feature | Use Case |
|---------|----------|
| Batch transactions | SPLIT command - atomic multi-transfer |
| Parallel nonces | Concurrent SMS processing |
| Transfer memos | Payment descriptions on-chain |
| Stablecoin fees | Pay fees in AlphaUSD |

## Setup

1. Clone and install:
```bash
git clone https://github.com/tobi-techy/TempoPay.git
cd TempoPay
bun install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Run:
```bash
bun run index.ts
```

4. Expose with ngrok:
```bash
ngrok http 3000
```

5. Configure Twilio webhook to `https://your-ngrok-url/sms`

## Environment Variables

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
SPONSOR_PRIVATE_KEY=
```

## Architecture

```
User (SMS) → Twilio → Express → Privy (wallets) → Tempo (blockchain)
                                     ↓
                              SQLite (requests)
```

## License

MIT
