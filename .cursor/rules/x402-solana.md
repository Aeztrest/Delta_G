---
description: x402 protocol reference for Solana — use when implementing payment-gated APIs, AI agent commerce, micropayments, or anything involving HTTP 402 + Solana/SVM
globs:
  - "**/*x402*"
  - "**/*payment*"
  - "**/*facilitator*"
  - "**/*paywall*"
  - "**/apps/server/**"
alwaysApply: false
---

# x402 Protocol — Solana Developer Reference

## What is x402?

x402 is an open payment standard (Apache-2.0) that turns HTTP 402 "Payment Required" into a real payment flow. A client hits your endpoint → you reply 402 with a JSON `PaymentRequired` object → the client signs a payment and retries with a `PAYMENT-SIGNATURE` header → your server verifies/settles → responds 200 with the resource. No accounts, no OAuth, no sessions.

On Solana this means sub-cent transaction costs and instant settlement — making true micropayments viable for AI agent APIs, paywalled content, and pay-per-use services.

## Protocol Flow (Solana)

```
Client → GET /premium
Server ← 402 + PAYMENT-REQUIRED header (base64 JSON)
Client reads accepts[], picks Solana option, builds a partially-signed tx
Client → GET /premium + PAYMENT-SIGNATURE header (base64 JSON)
Server → facilitator /verify (or local check)
Server → facilitator /settle (broadcasts tx on-chain)
Server ← 200 + PAYMENT-RESPONSE header + resource body
```

### Key Headers (V2)

| Header | Direction | Content |
|---|---|---|
| `PAYMENT-REQUIRED` | Server → Client | Base64-encoded `PaymentRequired` JSON |
| `PAYMENT-SIGNATURE` | Client → Server | Base64-encoded `PaymentPayload` JSON |
| `PAYMENT-RESPONSE` | Server → Client | Base64-encoded `SettlementResponse` JSON |

## Solana Network Identifiers (CAIP-2)

| Network | CAIP-2 ID | V1 String |
|---|---|---|
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `solana-devnet` |

USDC mint addresses:
- Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## SDKs with Solana Support

| SDK | Solana? | Install / URL |
|---|---|---|
| **Coinbase x402** (canonical) | Yes | `npm i @x402/express @x402/core @x402/svm` — [github.com/coinbase/x402](https://github.com/coinbase/x402) |
| **PayAI x402-solana** | Yes | `npm i @payai/x402-solana @payai/facilitator` — [github.com/PayAINetwork/x402-solana](https://github.com/PayAINetwork/x402-solana) |
| **Corbits** | Yes | `npm i @faremeter/payment-solana @faremeter/fetch` — [corbits.dev](https://corbits.dev/) |
| **Coinbase Python** | In dev | `pip install "x402[svm]"` |
| **Coinbase Go** | Yes | `go get github.com/x402-foundation/x402/go` |

## Facilitators (Solana)

| Facilitator | URL | Notes |
|---|---|---|
| **PayAI** (Solana-first) | `https://facilitator.payai.network` | Gasless, no API keys needed on free tier, covers tx fees |
| **x402.org testnet** | `https://x402.org/facilitator` | Works on Solana devnet + Base Sepolia |
| **Coinbase CDP** | `https://api.cdp.coinbase.com/platform/v2/x402` | Production facilitator |

## Quick Start — Seller (Express + Solana)

```bash
# Option A: PayAI starter (one command)
npx @payai/x402-express-starter@latest my-server

# Option B: Manual install
npm install @x402/express @x402/core @x402/evm @x402/svm
```

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
const svmAddress = process.env.SVM_ADDRESS!;
const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.payai.network"
});

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: svmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:84532",
            payTo: evmAddress,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme())
      .register("eip155:84532", new ExactEvmScheme()),
  ),
);

app.get("/weather", (req, res) => {
  res.json({ report: { weather: "sunny", temperature: 70 } });
});

app.listen(4021);
```

## Quick Start — Buyer (Fetch + Solana)

```bash
npx @payai/x402-fetch-starter@latest my-client
# or manual:
npm install @x402/fetch @x402/svm @x402/evm
```

```typescript
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);

const client = new x402Client();
registerExactEvmScheme(client, { signer: evmSigner });
registerExactSvmScheme(client, { signer: svmSigner });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment("http://localhost:4021/weather", {
  method: "GET",
});
const body = await response.json();

if (response.ok) {
  const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(
    (name) => response.headers.get(name)
  );
  console.log("Settled:", paymentResponse);
}
```

## Solana SVM Exact Scheme — Technical Details

On Solana, the `exact` scheme uses a **partially-signed transaction** (base64-encoded). The transaction MUST contain instructions in this order:

1. `SetComputeUnitLimit` — max 40,000 CU
2. `SetComputeUnitPrice` — max 5 microlamports/CU
3. `TransferChecked` — the actual SPL token transfer
4. *(Optional)* Lighthouse instructions (added by wallets like Phantom)

### Payment Payload (SVM)

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "accepted": {
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000000",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "payTo": "<recipient-address>",
    "maxTimeoutSeconds": 60
  },
  "payload": {
    "transaction": "<base64-encoded partially-signed tx>"
  }
}
```

### Duplicate Settlement Protection

Solana RPC returns success for duplicate tx submissions (dedup happens at consensus). Servers settling directly (without a facilitator) MUST maintain a short-lived in-memory cache of tx payloads and reject duplicates within ~120 seconds. The x402 SVM libraries include a built-in `SettlementCache`.

## Facilitator API

| Endpoint | Method | Purpose |
|---|---|---|
| `/verify` | POST | Verify payment without executing on-chain |
| `/settle` | POST | Broadcast and confirm tx on-chain |
| `/supported` | GET | List supported schemes/networks |
| `/discovery/resources` | GET | Bazaar — discover available merchants |

### PayAI Facilitator Notes

- `@payai/facilitator` package auto-connects to `https://facilitator.payai.network`
- Free tier works immediately, no API keys
- For production: set `PAYAI_API_KEY_ID` and `PAYAI_API_KEY_SECRET` env vars
- Live echo merchant for testing at `https://x402.payai.network/` (full refund)

## Framework Support

### Server Middleware

| Framework | Package | Starter |
|---|---|---|
| Express | `@x402/express` | `npx @payai/x402-express-starter@latest` |
| Hono | `@x402/hono` | — |
| Next.js | `@x402/next` | — |
| Fastify | `@x402/fastify` | — |
| FastAPI (Python) | `pip install "x402[fastapi,svm]"` | — |
| Flask (Python) | `pip install "x402[flask,svm]"` | — |
| Gin (Go) | `go get github.com/x402-foundation/x402/go` | — |

### Client Libraries

| Client | Package |
|---|---|
| fetch (TS) | `@x402/fetch` + `@x402/svm` |
| Axios (TS) | `@x402/axios` + `@x402/svm` |
| httpx (Python) | `pip install "x402[httpx,svm]"` |
| requests (Python) | `pip install "x402[requests,svm]"` |
| net/http (Go) | `github.com/x402-foundation/x402/go` |

## Starter Templates & Examples

| Resource | URL |
|---|---|
| Coinbase x402 examples | [github.com/coinbase/x402/examples](https://github.com/coinbase/x402/tree/main/examples) |
| x402 Foundation examples | [github.com/x402-foundation/x402/examples](https://github.com/x402-foundation/x402/tree/main/examples) |
| Nader Dabit's x402 Starter Kit | [github.com/dabit3/x402-starter-kit](https://github.com/dabit3/x402-starter-kit) |
| PayAI starter kits | [docs.payai.network/x402/quickstart](https://docs.payai.network/x402/quickstart) |
| Native Solana example (no deps) | [github.com/Woody4618/x402-solana-examples](https://github.com/Woody4618/x402-solana-examples) |

## Use Cases

- **AI Agent APIs**: Pay per LLM inference, image generation, or AI model call
- **MCP Server Monetization**: Charge for Model Context Protocol tools (see [MCPay.tech](https://mcpay.tech/))
- **Agent-to-Agent Payments**: Autonomous agents transacting for services
- **Paywalled Content**: Per-article, per-video, per-download micropayments
- **API Metering**: Per-RPC-call, per-query, per-compute-unit billing
- **Data Markets**: Real-time market data, analytics, IoT sensor readings

## Documentation Links

| Resource | URL |
|---|---|
| x402 Docs (canonical) | [docs.x402.org](https://docs.x402.org) |
| x402 LLM index | [docs.x402.org/llms.txt](https://docs.x402.org/llms.txt) |
| Solana Intro Guide | [solana.com/developers/guides/getstarted/intro-to-x402](https://solana.com/developers/guides/getstarted/intro-to-x402) |
| PayAI Docs | [docs.payai.network](https://docs.payai.network) |
| PayAI LLM index | [docs.payai.network/llms.txt](https://docs.payai.network/llms.txt) |
| x402-solana SDK | [github.com/PayAINetwork/x402-solana](https://github.com/PayAINetwork/x402-solana) |
| coinbase/x402 repo | [github.com/coinbase/x402](https://github.com/coinbase/x402) |
| awesome-solana-ai | [github.com/solana-foundation/awesome-solana-ai](https://github.com/solana-foundation/awesome-solana-ai) |
| awesome-x402 | [github.com/Merit-Systems/awesome-x402](https://github.com/Merit-Systems/awesome-x402) |

## Error Codes (Solana-specific)

| Error | Meaning |
|---|---|
| `invalid_exact_svm_payload_transaction_instructions_length` | Tx must have 3 required instructions (SetComputeUnitLimit, SetComputeUnitPrice, TransferChecked) + up to 2 optional Lighthouse |
| `insufficient_funds` | Payer doesn't have enough USDC |
| `invalid_network` | Network not supported by facilitator |
| `invalid_transaction_state` | Tx failed or was rejected on-chain |
| `duplicate_settlement` | Same tx submitted twice (cache hit) |

## Native Example (No Dependencies)

For a minimal server/client without any x402 SDK dependencies:

```bash
git clone https://github.com/Woody4618/x402-solana-examples
cd x402-solana-examples && npm install

# Terminal 1: Server
npm run usdc:server

# Terminal 2: Client (needs devnet USDC)
npm run usdc:client
```

Flow: Client → 402 → builds SPL transfer tx → signs → sends as X-Payment header → server verifies instructions + simulates → broadcasts → confirms → 200.
