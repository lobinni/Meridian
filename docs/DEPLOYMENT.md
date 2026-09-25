# Deployment guide

## Current deployment

The canonical deployment this repository targets:

| Field | Value |
| --- | --- |
| Contract address | `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97` |
| Network | GenLayer Studionet |
| Chain ID | `61999` (`0xf22f`) |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97 |
| Constructor args | none |

It is wired into `.env`, referenced as the fallback in `src/lib/config.ts`,
and documented in `.env.example`. Everything below explains how to reproduce
or replace this deployment — plus how to populate the live docket with the
sample disputes.

---

Three ways to put `contracts/meridian_tribunal.py` on the network, followed by
the frontend wiring and docket seeding. All values are centralized — see
[Changing the contract address](#changing-the-contract-address).

## Option A — GenLayer Studio (no code)

1. Open the Studio and load `contracts/meridian_tribunal.py` as a new
   contract file.
2. The constructor takes **no arguments** — press *Deploy*.
3. Copy the resulting contract address.
4. Paste it into `.env.local`:

   ```
   CONTRACT_ADDRESS=0x…
   ```

## Option B — GenLayer CLI

```bash
npm install -g genlayer        # one-time
genlayer network               # choose the target network
genlayer deploy                # deploy the project contract
```

Copy the printed address into `.env.local` as above.

## Option C — Scripted deployment (`deploy/deploy.ts`)

The repository ships a genlayer-js deployment script that also **writes the
address into `.env.local` automatically**.

```bash
# funded account for the target network
export DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# defaults: studionet + https://studio.genlayer.com/api
npx tsx deploy/deploy.ts

# overrides
TARGET_ENV=localnet GENLAYER_RPC_URL=http://localhost:4000/api npx tsx deploy/deploy.ts
```

On success the script prints:

```
✔ Meridian Tribunal deployed
  address: 0x…
  wrote CONTRACT_ADDRESS to .env.local
```

If the address cannot be parsed from the receipt, the receipt is printed so it
can be copied manually.

## Seeding the docket

`deploy/seed.ts` files every template from `samples/cases.json` onto the
deployed contract — the fastest way to get a populated, judgeable docket for
manual testing.

```bash
# plaintiff/funder (required) + defendant (optional but recommended)
DEPLOYER_PRIVATE_KEY=0xA… SECONDARY_PRIVATE_KEY=0xB… npx tsx deploy/seed.ts
```

Behavior:

- Idempotent — samples whose title already exists on the docket are skipped.
- Each sample becomes an `OPEN` case: plaintiff = deployer, defendant =
  secondary account.
- When `SECONDARY_PRIVATE_KEY` is present and the sample ships a defense,
  the defense is submitted too → the case lands directly in `DEFENSE`,
  ready for `judge_case`.
- Without a secondary key, samples are filed against
  `SEED_DEFENDANT_ADDRESS` (default: the zero-vanity dead address) and stay
  in `OPEN`.
- Overrides: `CONTRACT_ADDRESS`, `GENLAYER_RPC_URL`.

After seeding, stake outcomes from a third wallet in the UI (party wallets
are blocked by the contract), summon verdicts, and claim — the full script
of that walkthrough lives in [samples/README.md](../samples/README.md).

## Wallet / network parameters

The dApp adds and switches the network automatically on connect. For manual
setup in MetaMask:

| Field | Value |
| --- | --- |
| Network name | Genlayer Studio Network |
| Chain ID | `61999` (`0xf22f`) |
| Currency symbol | `GEN` |
| RPC URL | `https://studio.genlayer.com/api` |

### Wallet troubleshooting

- **Connected but the dApp still shows "Connect MetaMask"** — older builds
  aborted the connection when the network switch failed. Current builds
  connect the account first and offer the switch separately; hard-refresh the
  page (to clear cached code) and press *Connect MetaMask* again.
- **"A network request is already pending in your wallet"** — open MetaMask
  manually and confirm or reject the pending prompt, then retry.
- **Chain registered under a different name** — MetaSwitch only needs the
  chain id (`0xf22f`); the app adds the network with the canonical
  registration (name *Genlayer Studio Network*, RPC
  `https://studio.genlayer.com/api`), which matches the SDK definition exactly.
- **Everything else failing** — add the network manually from the table above,
  switch to it inside MetaMask, then press *Connect MetaMask* again.

## Changing the contract address

Everything funnels through one module — `src/lib/config.ts`:

| Knob | Source | Fallback |
| --- | --- | --- |
| Contract address | `CONTRACT_ADDRESS` | `CONTRACT_ADDRESS` constant |
| RPC endpoint | `GENLAYER_RPC_URL` | `https://studio.genlayer.com/api` |
| Chain id | `GENLAYER_CHAIN_ID` | `61999` |
| Network label | `GENLAYER_CHAIN_NAME` | `Studionet` |
| Token ticker | `NATIVE_SYMBOL` | `GEN` |
| Explorer base URL | `EXPLORER_URL` | `https://explorer-studio.genlayer.com` |

Redeploy → update `.env.local` (or the fallback constant) → restart the dev
server. Nothing else needs to change; reads, writes, the leaderboard, the
stake ledger and the footer status strip all follow automatically.

## Verification checklist

1. `npm run dev` then open the dApp.
2. Connect MetaMask — the banner should report *Studionet · live*.
3. Footer strip should read *Live contract 0xc3f4…Cf97* and link to the
   explorer deployment page.
4. Run `npx tsx deploy/seed.ts` once, then from three wallets: defend a
   seeded case, place a small stake on it, summon the verdict, claim — each
   step should advance through consensus without a revert, and the docket /
   leaderboard / stake ledger should reflect every state transition.
