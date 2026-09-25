# Testing guide

Two tiers of testing are provided:

1. **Automated** — `test/test_meridian_tribunal.py`, an integration suite run
   with gltest against the localnet simulator.
2. **Manual (live)** — the sample dispute pack in `samples/cases.json`, run
   by hand (or via the seeder) against the deployed Studionet contract:
   `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97`
   ([explorer](https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97)).

---

## Part 1 — Automated suite (localnet)

The suite validates filing
guards, defense access control, parimutuel staking rules, claim safety and a
full AI-judged lifecycle.

## Setup

```bash
pip install genlayer-test pytest
```

Terminal 1 — start the localnet simulator:

```bash
gltest --network localnet
```

Terminal 2 — run the suite:

```bash
# whole suite (full-cycle integration test included)
gltest test/

# unit-style guard tests only (fast, no AI consensus)
gltest test/ -m "not integration"

# a single test
gltest test/test_meridian_tribunal.py::test_bet_updates_pools_and_ledger
```

## What each test covers

| Test | Asserts |
| --- | --- |
| `test_deploy_initial_state` | Counter starts at zero; docket empty |
| `test_file_case_creates_record` | Filing stores parties, title, `OPEN` status, zero escrow |
| `test_file_case_input_validation` (parametrized) | Blank title / description / evidence all revert |
| `test_cannot_file_against_self` | Self-filing reverts |
| `test_only_defendant_can_defend` | Strangers revert; defendant succeeds → `DEFENSE`; re-defense reverts |
| `test_judgment_requires_defense_first` | `judge_case` on an `OPEN` case reverts |
| `test_bet_requires_value` | Zero-value stake reverts |
| `test_parties_cannot_bet_on_own_case` | Plaintiff & defendant both blocked |
| `test_invalid_outcome_rejected` | Unknown outcome string reverts |
| `test_bet_updates_pools_and_ledger` | Buckets, escrow and bet records update exactly |
| `test_escrow_matches_received_value_across_cases` | Per-case escrow ledgers and the native contract balance track received value across multiple cases |
| `test_no_outcome_switching_but_top_up_allowed` | Switch reverts; same-outcome top-up compounds |
| `test_claim_before_verdict_reverts` | Claims blocked pre-judgment |
| `test_full_cycle_verdict_and_payout` *(integration)* | AI judgment lands inside validity ranges, staking closes, winner claims once and is paid, loser excluded |

## Mocked non-determinism

The integration test is intentionally AI-agnostic: it asserts the *shape* of
the judgment (canonical verdict, severity 1–10, non-empty reasoning) rather
than a fixed outcome. For fully deterministic judgment tests, spin up mock
validators from gltest and pin the model's answer:

```python
validator_factory = get_validator_factory()
validators = validator_factory.batch_create_mock_validators(count=5)
transaction_context = {"validators": [v.to_dict() for v in validators]}
```

…then pass `transaction_context=` into `factory.deploy(...)` and the
`judge_case(...).transact(...)` call. Mock web responses can be attached the
same way via `mock_web_response` for hermetic evidence scraping.

## Native value in tests

Payable calls pass wei-sized integers through `transact(value=…)`. The suite
uses `ONE_GEN = 10**18`; funded accounts are produced with
`gltest.create_account()` and pre-funded by the simulator on localnet.

## Wallet network-switch tests (no browser needed)

`test/wallet-switch.test.mts` exercises the MetaMask connection and
network-switch logic against a mocked EIP-1193 provider — covering plain
object errors (4901/4902/4001/-32002), pending requests, rejections, and the
guarantee that connecting never fails just because the switch did.

```bash
npx tsx test/wallet-switch.test.mts   # 10 scenarios, all must pass
```

## Diagnosing a live RPC failure

If a write fails on Studionet with a low-level RPC error, open the browser
DevTools console **before reproducing** — every provider call is logged:

- `[genlayer] eth_sendTransaction OK in …ms` — the wallet accepted and the
  gateway responded. The failure is then inside consensus; check the
  transaction on the explorer (status, leader receipts).
- `[genlayer] <method> FAILED — code=… message=…` — the exact method and the
  underlying error object (wallet rejection, gateway rule violation, or a
  reverted consensus call) including its `data` payload.
- `Wallet is on chain N but the protocol expects 61999` — the wallet was on
  the wrong network at the moment of the write; switch in the account menu.
- `[genlayer-js] GenLayer RPC error (...)` — emitted by the SDK itself for
  gateway-side failures; the message embeds the gateway's response verbatim.

Most "defense fails after staking" reports trace to either a wallet network
mismatch (guard above) or a gateway rule on calldata size for the defense
text — both now surface verbosely instead of an opaque toast.

### Fast guard matrix to re-verify on chain

| Wallet state at write time | Expected |
| --- | --- |
| Wrong network (e.g. mainnet 1) | Clear mismatch toast, no popup |
| Chain 61999 but defense > max calldata | Gateway rule error with payload in console |
| Chain 61999, valid defense | `eth_sendTransaction OK` → toast updates on ACCEPTED |

## Running against other networks

The same suite can be pointed at a shared environment instead of the local
simulator:

```bash
gltest --network localnet    # default
gltest --network studionet test/ -m "not integration"
```

On live networks, keep the pure guard tests (payment hooks identify funded
accounts you control); the nondeterministic AI judgment test is best kept on
localnet where validator timing is fast and free.

---

## Part 2 — Manual live testing (Studionet, chain 61999)

This tier exercises the **deployed contract** —
`0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97` — through the real consensus
pipeline. Use three wallets:

| Wallet | Role |
| --- | --- |
| A | Plaintiff (also summons the verdict) |
| B | Defendant |
| C | Spectator / staker |

### Preparing disputes

Two options:

- **Manual** — copy a template from `samples/cases.json` into the *File a
  case* form (title, description, defendant = wallet B, comma-separated
  evidence URLs). Templates marked `await-defense` skip step "defense" below;
  `full-cycle` / `judge-now` templates include ready defense text.
- **Scripted** — `DEPLOYER_PRIVATE_KEY=0xA… SECONDARY_PRIVATE_KEY=0xB… npx tsx deploy/seed.ts`
  files all samples at once (see [DEPLOYMENT.md](DEPLOYMENT.md#seeding-the-docket)).

### Expected contract-anchored behavior

| Step | Action (wallet) | Contract effect to verify |
| --- | --- | --- |
| 1 | File case (A) | Case appears `OPEN`; `get_case.escrow = 0`; timestamped on explorer |
| 2 | Submit defense (B) | Status `DEFENSE`; defense fields populated; non-B wallets cannot defend |
| 3 | Stake outcomes (C) | `place_bet` payable; `bet_totals` buckets grow; `case_escrow` equals total staked |
| 3b | Stake as party (A or B) | Reverts — party exclusion guard |
| 3c | Stake on a different outcome second time (C) | Reverts — no outcome switching |
| 3d | Stake on the same outcome again (C) | Succeeds — top-up compounds into one bet record |
| 4 | Summon verdict (any) | `judge_case` runs the nondet pipeline; case lands `JUDGED` with verdict, severity 1–10, reasoning |
| 4b | Stake after judgment | Reverts — `Betting is closed` |
| 4c | Summon again | Reverts — `Case already judged` |
| 5 | Claim as winner (C) | Native GEN arrives; proportional share = `stake × pool / winning_bucket`; `claimed=true` |
| 5b | Claim again (C) | Reverts — `Winnings already claimed` |
| 5c | Claim as loser / non-bettor | Reverts / zero payout |

Verdicts are genuinely AI-rendered, so exact outcomes vary per run — assert
the *shape* (canonical verdict, severity range, payout math), not a fixed
verdict. The evidence URLs in the samples are stable public pages so the
validator scrape step always has real content.

## Manual QA checklist (frontend)

1. **Connect** — MetaMask prompts, switches to chain 61999, header shows
   *Studionet · live*; the footer links to the explorer deployment page.
2. **File** — validation blocks blank fields inline; success toast, case
   appears first on the docket with a zero pool.
3. **Defend** — from the defendant wallet, the case file shows the defense
   form; after submission the timeline advances.
4. **Stake** — from a third wallet, pick an outcome, quick amounts work,
   projected share updates; parties see the exclusion notice instead.
5. **Judge** — *Summon verdict* toasts through consensus; the judgment panel
   renders verdict, severity and reasoning.
6. **Claim** — winners see *Claim winnings*; after claiming, the record shows
   *Settled* in the stake ledger.
7. **Explorer cross-check** — every state change is visible on the contract's
   explorer page (transactions tab) matching the UI, because the interface
   reads exclusively from the deployed contract (no simulated data exists).
8. **Misconfiguration guard** — empty `CONTRACT_ADDRESS` shows a
   clear "contract not configured" notice and disables on-chain actions;
   restoring the value (and restarting) brings the live docket back.
