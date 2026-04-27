---
name: x402-solana
version: 1.0.0
description: |
  x402 protocol reference for Solana — covers HTTP 402 payment-gated APIs, AI agent commerce,
  micropayments, facilitators, SDKs, and complete code examples for buyer/seller flows on Solana.
homepage: https://x402.org
license: Apache-2.0
compatibility: Claude Code, Codex, Cursor
metadata: {"category":"payments","tags":"x402,solana,payments,micropayments,http-402,facilitator,payai,ai-agent,svm,usdc"}
---

# x402 Solana Protocol Reference

This skill provides comprehensive reference material for implementing the x402 payment protocol on Solana. Use this when building payment-gated APIs, AI agent commerce, or any pay-per-use service on Solana.

## When To Use

Use this skill when:
- Implementing x402 payment flows on Solana (buyer or seller side)
- Adding payment middleware to Express/Hono/Next.js/Fastify/FastAPI/Flask servers
- Building AI agents that need to pay for API access on Solana
- Working with PayAI facilitator or any Solana x402 facilitator
- Integrating micropayments, paywalls, or pay-per-request patterns
- Working with SPL token transfers in x402 context

## 1. Protocol Overview

x402 turns HTTP 402 "Payment Required" into a real payment flow:

1. Client requests a resource → `GET /premium`
2. Server responds `402` with `PAYMENT-REQUIRED` header (base64 JSON with payment requirements)
3. Client picks a Solana payment option, builds a partially-signed SPL token transfer tx
4. Client retries with `PAYMENT-SIGNATURE` header (base64 JSON with the tx)
5. Server verifies via facilitator's `/verify`, performs the work, then `/settle` broadcasts on-chain
6. Server responds `200` with `PAYMENT-RESPONSE` header + resource body

No accounts, no OAuth, no sessions, no API keys on the client side.

### Key Headers (V2)

| Header | Direction | Content |
|---|---|---|
| `PAYMENT-REQUIRED` | Server → Client | Base64-encoded `PaymentRequired` JSON |
| `PAYMENT-SIGNATURE` | Client → Server | Base64-encoded `PaymentPayload` JSON |
| `PAYMENT-RESPONSE` | Server → Client | Base64-encoded `SettlementResponse` JSON |

## 2. Solana Network Details

### Network Identifiers (CAIP-2)

| Network | CAIP-2 ID | Legacy V1 String |
|---|---|---|
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `solana-devnet` |

### USDC Mint Addresses

- **Mainnet**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Devnet**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

### SVM Exact Scheme — Transaction Structure

The Solana `exact` scheme uses a **partially-signed transaction** with instructions in this mandatory order:

1. **SetComputeUnitLimit** — max 40,000 CU
2. **SetComputeUnitPrice** — max 5 microlamports per CU
3. **TransferChecked** — the actual SPL token transfer
4. *(Optional)* Lighthouse instructions (auto-added by wallets like Phantom)

### Duplicate Settlement Protection

Solana RPC returns success for duplicate tx submissions (dedup at consensus). Servers settling directly MUST maintain a short-lived in-memory cache (~120s TTL) of tx payloads and reject duplicates. The x402 SVM libraries include a built-in `SettlementCache`.

## 3. SDKs with Solana Support

| SDK | Solana Support | Installation |
|---|---|---|
| **Coinbase x402** (canonical) | Yes | `npm i @x402/express @x402/core @x402/svm` |
| **PayAI x402-solana** | Yes | `npm i @payai/x402-solana @payai/facilitator` |
| **Corbits** | Yes | `npm i @faremeter/payment-solana @faremeter/fetch` |
| **x402 Python** | Yes | `pip install "x402[svm]"` |
| **x402 Go** | Yes | `go get github.com/x402-foundation/x402/go` |

### Repos

- **coinbase/x402**: https://github.com/coinbase/x402
- **x402-foundation/x402**: https://github.com/x402-foundation/x402
- **PayAINetwork/x402-solana**: https://github.com/PayAINetwork/x402-solana

## 4. Facilitators

| Facilitator | URL | Notes |
|---|---|---|
| **PayAI** (Solana-first) | `https://facilitator.payai.network` | Gasless, no API keys on free tier, covers tx fees |
| **x402.org testnet** | `https://x402.org/facilitator` | Solana devnet + Base Sepolia |
| **Coinbase CDP** | `https://api.cdp.coinbase.com/platform/v2/x402` | Production |

### Facilitator Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/verify` | POST | Verify payment without on-chain execution |
| `/settle` | POST | Broadcast + confirm tx on-chain |
| `/supported` | GET | List supported schemes/networks |
| `/discovery/resources` | GET | Bazaar — discover merchants |

### PayAI Facilitator

```typescript
import { facilitator } from "@payai/facilitator";
import { HTTPFacilitatorClient } from "@x402/core/server";
const facilitatorClient = new HTTPFacilitatorClient(facilitator);
```

Free tier works immediately. For production set `PAYAI_API_KEY_ID` and `PAYAI_API_KEY_SECRET` env vars.

## 5. Seller Quick Start (Express + Solana)

### One-Command Scaffold

```bash
npx @payai/x402-express-starter@latest my-server
```

### Manual Setup

```bash
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

app.listen(4021, () => console.log("Listening on :4021"));
```

### Other Server Frameworks

**Hono:**
```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
```

**Next.js (API route):**
```typescript
import { withX402 } from "@x402/next";
export const GET = withX402(handler, routeConfig, server);
```

**Fastify:**
```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/fastify";
```

**FastAPI (Python):**
```python
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.mechanisms.svm.exact import ExactSvmServerScheme
server.register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", ExactSvmServerScheme())
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

**Flask (Python):**
```python
from x402.http.middleware.flask import payment_middleware
payment_middleware(app, routes=routes, server=server)
```

**Gin (Go):**
```go
import ginmw "github.com/x402-foundation/x402/go/http/gin"
import svm "github.com/x402-foundation/x402/go/mechanisms/svm/exact/server"
```

### Route Configuration

```typescript
interface RouteConfig {
  accepts: Array<{
    scheme: string;       // "exact" or "upto"
    price: string;        // "$0.001" or atomic units
    network: string;      // CAIP-2 format
    payTo: string;        // wallet address
  }>;
  description?: string;
  mimeType?: string;
  extensions?: object;    // e.g. bazaar discovery
}
```

## 6. Buyer Quick Start (Fetch + Solana)

### One-Command Scaffold

```bash
npx @payai/x402-fetch-starter@latest my-client
```

### Manual Setup

```bash
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
  const receipt = new x402HTTPClient(client).getPaymentSettleResponse(
    (name) => response.headers.get(name)
  );
  console.log("Settled:", receipt);
}
```

### Axios Client

```typescript
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
const api = wrapAxiosWithPayment(axios.create({ baseURL }), client);
const response = await api.get("/weather");
```

### Python Client (httpx)

```python
from x402 import x402Client
from x402.http.clients import x402HttpxClient
from x402.mechanisms.svm import KeypairSigner
from x402.mechanisms.svm.exact.register import register_exact_svm_client

client = x402Client()
svm_signer = KeypairSigner.from_base58(os.getenv("SVM_PRIVATE_KEY"))
register_exact_svm_client(client, svm_signer)

async with x402HttpxClient(client) as http:
    response = await http.get("http://localhost:4021/weather")
```

## 7. Payment Data Structures (Solana)

### PaymentRequired (server → client in 402 response)

```json
{
  "x402Version": 2,
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": {
    "url": "https://api.example.com/premium",
    "description": "Premium data",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "amount": "1000000",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "<recipient-solana-address>",
      "maxTimeoutSeconds": 60,
      "extra": { "feePayer": "<facilitator-address>" }
    }
  ]
}
```

### PaymentPayload (client → server in retry)

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "accepted": { "...same as the chosen accepts[] item..." },
  "payload": {
    "transaction": "<base64-encoded partially-signed tx>"
  }
}
```

### SettlementResponse (server → client after settle)

```json
{
  "success": true,
  "transaction": "<solana-tx-signature>",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "payer": "<payer-solana-address>"
}
```

## 8. Native Example (No SDK Dependencies)

For a zero-dependency implementation:

```bash
git clone https://github.com/Woody4618/x402-solana-examples
cd x402-solana-examples && npm install
npm run usdc:server   # Terminal 1
npm run usdc:client   # Terminal 2 (needs devnet USDC)
```

The server manually: decodes X-Payment header → deserializes transaction → introspects SPL token instructions → checks recipient + amount → simulates → broadcasts → confirms → returns 200.

## 9. Use Cases

- **AI Agent API Access**: Pay per LLM inference, image generation, model call
- **MCP Server Monetization**: Charge for Model Context Protocol tools (MCPay.tech)
- **Agent-to-Agent Payments**: Autonomous agents transacting for services
- **Paywalled Content**: Per-article, per-video, per-download micropayments
- **API Metering**: Per-RPC, per-query, per-compute-unit billing
- **Data Markets**: Real-time market data, analytics, IoT sensor readings

## 10. Error Codes (Solana)

| Code | Description |
|---|---|
| `invalid_exact_svm_payload_transaction_instructions_length` | Tx must have 3+ required instructions in order |
| `insufficient_funds` | Payer doesn't have enough USDC |
| `invalid_network` | Network not supported |
| `invalid_transaction_state` | Tx failed on-chain |
| `duplicate_settlement` | Same tx submitted twice |
| `invalid_payload` | Malformed payment payload |

## 11. Documentation & Resources

### Core Docs
- x402 docs: https://docs.x402.org
- x402 LLM-friendly index: https://docs.x402.org/llms.txt
- Solana intro guide: https://solana.com/developers/guides/getstarted/intro-to-x402

### PayAI
- PayAI docs: https://docs.payai.network
- PayAI LLM index: https://docs.payai.network/llms.txt
- x402-solana SDK: https://github.com/PayAINetwork/x402-solana
- Live facilitator: https://facilitator.payai.network

### Starter Templates
- Coinbase x402 examples: https://github.com/coinbase/x402/tree/main/examples
- x402 Foundation examples: https://github.com/x402-foundation/x402/tree/main/examples
- PayAI quickstart kits: https://docs.payai.network/x402/quickstart
- Nader Dabit's starter kit: https://github.com/dabit3/x402-starter-kit
- Native Solana examples: https://github.com/Woody4618/x402-solana-examples

### Reference
- coinbase/x402 canonical repo: https://github.com/coinbase/x402
- x402-foundation/x402 repo: https://github.com/x402-foundation/x402
- awesome-solana-ai: https://github.com/solana-foundation/awesome-solana-ai
- awesome-x402: https://github.com/Merit-Systems/awesome-x402

## 12. Going to Production

1. **Switch facilitator URL** to production (PayAI or Coinbase CDP)
2. **Update network IDs** from devnet to mainnet:
   - `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` → `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
3. **Set wallet addresses** to real mainnet addresses
4. **Add PayAI API keys** for production: `PAYAI_API_KEY_ID`, `PAYAI_API_KEY_SECRET`
5. **Test with small amounts** first, verify payments arrive in your wallet
