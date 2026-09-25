# Meridian Tribunal

**Decentralized AI-powered dispute resolution with parimutuel verdict markets.**

> *"Two sides argue. The network decides."*

Meridian Tribunal is an on-chain justice protocol built on GenLayer's AI-native blockchain. File a case, mount a defense, and let independent AI validators scrape the evidence and render a verdict through optimistic consensus — while spectators stake native GEN on the outcome in a zero-house parimutuel market.

No human bias. No backroom settlements. Just transparent, machine-rendered justice.

---

## Live deployment

| | |
| --- | --- |
| **Network** | GenLayer Studionet |
| **Chain ID** | `61999` |
| **RPC** | `https://studio.genlayer.com/api` |
| **Contract** | `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97` |
| **Explorer** | [view deployment](https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97) |
| **Currency** | GEN (native) |

The repository is preconfigured against this deployment — after `npm install`
the dApp reads and settles directly on-chain. To point at your own
deployment, see [Changing the contract address](#changing-the-contract-address).

## How it works

1. **File a case** — A plaintiff names a defendant, describes the dispute and links evidence URLs.
2. **Submit a defense** — The defendant answers with counter-arguments and counter-evidence.
3. **Stake on the outcome** — Anyone except the parties can stake native GEN on *Guilty*, *Not Guilty*, or *Insufficient Evidence*.
4. **Summon the verdict** — Validators independently scrape every linked page, run the judging prompt and agree on a verdict through optimistic consensus.
5. **Claim winnings** — Winners split the **entire pool** proportionally to their stake, paid out as real on-chain GEN transfers. If nobody backed the verdict, every staker is refunded.

## Tech stack

### Intelligent contract (Python / GenVM)

- GenLayer intelligent contract with `@allow_storage` dataclasses for cases and bets.
- `TreeMap` storage for the docket, the betting ledger and the per-case escrow.
- `gl.nondet.web.render()` to scrape evidence during judgment.
- `gl.nondet.exec_prompt()` for verdict generation, verified by independent validators via partial-field matching (verdict must match, severity drift ≤ ±2).
- Payable staking via `@gl.public.write.payable` reading `gl.message.value`.
- Native payouts via a `_Recipient.emit_transfer()` EVM interface.

### Frontend (TypeScript / Next.js)

- Next.js (App Router) + React with TanStack Query for live polling.
- `genlayer-js` SDK bridging reads and MetaMask-signed writes.
- Radix UI dialogs, Lucide iconography, hand-tuned CSS design system.
- Light sage / ink / mint editorial aesthetic with a dark technical hero.

## Project structure

```
meridian-tribunal/
├── contracts/
│   └── meridian_tribunal.py     # Intelligent contract (cases + staking + AI verdicts)
├── deploy/
│   ├── deploy.ts                # genlayer-js deployment script (writes .env.local)
│   └── seed.ts                  # Seeds samples/cases.json onto the live docket
├── samples/
│   ├── cases.json               # Ready-to-file dispute templates (live testing)
│   └── README.md                # Manual on-chain testing walkthrough
├── scripts/
│   └── generate-avatars.mjs     # Generates hero SVG artwork + typed manifest
├── test/
│   └── test_meridian_tribunal.py# gltest integration suite (guards + full cycle)
├── docs/
│   ├── ARCHITECTURE.md          # Protocol architecture and data flows
│   ├── CONTRACT_API.md          # Full contract method reference
│   ├── DEPLOYMENT.md            # Studio / CLI / scripted deployment guide
│   └── TESTING.md               # Test suite walkthrough and manual QA checklist
├── src/
│   ├── app/                     # Routes: docket (/) and faucet (/faucet)
│   ├── components/              # Navbar, Hero, CaseFeed, CaseDetail,
│   │                            # FileCaseModal, BettingPanel, Leaderboard,
│   │                            # BetHistory, AccountPanel, Footer
│   └── lib/
│       ├── config.ts            # ← single source of truth (contract address, chain)
│       ├── avatars.generated.ts # AUTO-GENERATED hero artwork manifest
│       ├── contracts/           # MeridianTribunal bridge (live genlayer-js) + types
│       ├── hooks/               # TanStack Query hooks + wallet guard
│       ├── genlayer/            # Network config + MetaMask provider
│       └── utils/               # Formatting helpers
└── .env.example
```

## Quick start

### Prerequisites

- Node.js 18+
- MetaMask configured for the GenLayer network
  (chain id **61999**, RPC `https://studio.genlayer.com/api`) — the app adds it automatically on connect.
- Optional: [GenLayer CLI](https://docs.genlayer.com/) for contract deployment.

### 1. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and connect MetaMask — the app offers to add the
GenLayer network (chain 61999) automatically. The dApp boots in **live mode**
against the preconfigured Studionet deployment.

> The dApp is **live-only** — every case, stake and verdict shown is read
> directly from the deployed contract; nothing is simulated. If the contract
> address is removed from the configuration, on-chain actions are disabled
> and a "contract not configured" notice is shown instead of any fallback
> data.

### 2. Deploy your own contract (optional)

```bash
DEPLOYER_PRIVATE_KEY=0x… npx tsx deploy/deploy.ts
```

The script prints the deployed address and writes it to `.env.local`. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Studio and CLI alternatives.

### 3. Exercise the live docket

Use the ready-made dispute templates:

```bash
# manual — copy/paste from samples/cases.json through the UI
# scripted — file every sample in one go:
DEPLOYER_PRIVATE_KEY=0xA… SECONDARY_PRIVATE_KEY=0xB… npx tsx deploy/seed.ts
```

Then follow the guided walkthrough in [samples/README.md](samples/README.md):
file → defend → stake → summon verdict → claim, plus a table of guard
scenarios and the reverts each one should produce on-chain.

## Changing the contract address

Everything reads from one place:

| Option | Where | When to use |
| --- | --- | --- |
| `CONTRACT_ADDRESS` env var | `.env.local` | Preferred — no code edits, survives repo pulls |
| `CONTRACT_ADDRESS` fallback constant | `src/lib/config.ts` | Hard pin an address in source |

Redeploy → update either value → restart. No other file needs to change.

## The parimutuel market

- All stakes on a case form one shared pool, split across three outcome buckets.
- After the verdict, the **entire pool** is distributed pro-rata to stakers of the winning outcome.
- If the winning outcome has no backers, all stakers are refunded in full.
- Plaintiffs and defendants are barred from staking on their own case; staking closes at judgment.

## Security model

- **Defense-gated judgment** — verdicts cannot be summoned before the defense is on record, blocking rush-to-verdict attacks.
- **Prompt-injection hardening** — case data is wrapped in BEGIN/END markers with explicit ignore instructions; titles truncate at 200 chars, statements at 5,000, scraped pages at 2,000.
- **Claim safety** — state flips to `claimed` before the external transfer, double claims revert, and the escrow balance is checked before paying.
- **Market integrity** — closed staking after judgment, party exclusion, one outcome per wallet per case (top-ups allowed, switching rejected).

## Publish & host

Ship the repo and put the dApp online in two steps — **no database required**:

```bash
# 1. GitHub
git init && git add . && git commit -m "Meridian Tribunal"
git branch -M main
gh repo create meridian-tribunal --public --source=. --remote=origin --push

# 2. Vercel (framework: Next.js, env vars: none needed)
vercel --prod
```

Full walkthrough — dashboard import, optional env overrides, post-deploy
checks: [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — flows, data model, verdict consensus
- [docs/CONTRACT_API.md](docs/CONTRACT_API.md) — every contract method, view and error
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Studio, CLI, scripted deployments and docket seeding
- [docs/TESTING.md](docs/TESTING.md) — gltest suite walkthrough + live manual testing
- [docs/PUBLISHING.md](docs/PUBLISHING.md) — GitHub + Vercel hosting without a database
- [samples/README.md](samples/README.md) — sample dispute templates and the full on-chain walkthrough

## License

MIT.
