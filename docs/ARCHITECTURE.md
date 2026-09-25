# Architecture

Meridian Tribunal is a two-layer protocol: a GenLayer **intelligent contract**
holds all state and funds, while a **Next.js frontend** renders the docket,
collects arguments and routes stakes through MetaMask.

> **Reference deployment** — `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97` on
> GenLayer Studionet (chain 61999)
> ([explorer](https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97)).

```
┌──────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ MetaMask │──▶│ Next.js dApp          │──▶│ genlayer-js SDK    │
│ (signer) │   │ - @/lib/config        │   │ read / write /     │
└──────────┘   │ - contracts bridge    │   │ waitForReceipt     │
               │ - TanStack Query      │   └─────────┬─────────┘
               └──────────────────────┘             │ JSON-RPC (61999)
                                                    ▼
                                      ┌──────────────────────────────┐
                                      │ meridian_tribunal.py          │
                                      │ - TreeMap docket + ledger     │
                                      │ - payable staking / escrow    │
                                      │ - nondet judgment (AI)        │
                                      │ - parimutuel payouts          │
                                      └──────────────────────────────┘
```

## Case lifecycle

```
file_case            submit_defense            judge_case
  ┌──────┐            ┌─────────┐              ┌────────┐
  │ OPEN │ ────────▶  │ DEFENSE │ ──────────▶  │ JUDGED │
  └──────┘  defendant └─────────┘  any caller  └────────┘
     only, once                       requires DEFENSE;
                                      AI validators agree
                                      verdict + severity

Staking (place_bet, payable)        Claiming (claim_winnings)
  · open while OPEN or DEFENSE        · only after JUDGED
  · parties excluded                  · winners split whole pool
  · one outcome per wallet            · refund-all if verdict unbacked
```

## Data model (contract storage)

| Storage | Type | Purpose |
| --- | --- | --- |
| `cases` | `TreeMap[u256, Case]` | The docket — parties, statements, verdict, status |
| `bets` | `TreeMap[str, Bet]` | One bet per `caseId:bettor` key |
| `bet_totals` | `TreeMap[str, u256]` | Pool bucket per `caseId:outcome` |
| `case_escrow` | `TreeMap[u256, u256]` | Native GEN actually received per case |
| `case_count` | `u256` | Sequential case id source |

A `Case` carries both parties' statements and links, plus the rendered
`verdict`, `reasoning` and `severity` (1–10). A `Bet` records the wallet,
outcome, amount and claim flag.

## Judgment consensus

`judge_case` runs inside `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`:

1. **Leader** scrapes every plaintiff and defense URL with
   `gl.nondet.web.render` (2,000 chars each), assembles the judging prompt —
   with user data wrapped in `BEGIN/END` injection guards — and executes
   `gl.nondet.exec_prompt(..., response_format="json")`.
2. The result is normalized: verdict forced into the canonical triple,
   severity clamped to 1..10.
3. **Validators** independently re-run the same pipeline and vote with
   partial-field matching: the verdict string must be identical, severity may
   drift by at most two points.
4. The agreed result is written back and the case transitions to `JUDGED`.

## Parimutuel math

Let `P = guilty + not_guilty + insufficient` (the whole pool) and `W` the
bucket matching the final verdict.

- `W > 0` and bettor backed the verdict: `payout = amount × P / W`
- `W == 0`: every staker is refunded `amount`
- Backed the verdict but `claimed`: revert

State is always mutated **before** `_Recipient(sender).emit_transfer(...)`,
and the contract balance is verified before each payout.

## Frontend layers

| Layer | File | Responsibility |
| --- | --- | --- |
| Config | `src/lib/config.ts` | Contract address, chain id, RPC, labels — **edit here to repoint the app** |
| Network | `src/lib/genlayer/client.ts` | MetaMask wrappers, network add/switch |
| Wallet | `src/lib/genlayer/WalletProvider.tsx` | Connection state, listeners, disconnect memory |
| Docket cache | `src/app/api/tribunal/route.ts` | Server-side 4s stale-while-revalidate cache around `get_all_cases` — collapses portal polling into one upstream `gen_call` so first paint is near-instant on a warm cache |
| Bridge | `src/lib/contracts/MeridianTribunal.ts` | genlayer-js reads (via the cache where possible) / writes against the deployed contract |
| Hooks | `src/lib/hooks/useMeridianTribunal.ts` | Query caching, adaptive polling (feed 8s / detail 20s), batched bets, mutations |
| UI | `src/components/*` | Docket, case file modal, market panel, leaderboard, ledger |

## Live-only data path

The dApp renders exactly what the contract stores — no simulated docket,
pools or verdicts exist anywhere in the interface.

- `CONTRACT_ADDRESS` **set** (the default) → reads hit the RPC
  gateway, writes are signed in MetaMask and awaited until `ACCEPTED`.
- **unset/empty** → on-chain actions are disabled and the interface shows a
  "contract not configured" notice; reads return empty results. Repairing
  the configuration is a single env change — no other file is involved.

Republishing or redeploying therefore never risk showing synthetic content:
the empty docket genuinely means the contract holds zero cases.
