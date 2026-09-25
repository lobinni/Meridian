# Sample dispute templates

`cases.json` is a pack of ready-to-file disputes designed for **manual testing
against the live contract** on GenLayer Studionet (chain 61999):

- contract `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97`
- explorer https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97

Every template uses stable public URLs for evidence so the AI validators can
actually scrape pages during a real judgment. Fields map 1:1 to the contract
methods — nothing here depends on the frontend.

## Roles you need

| Wallet | Role | Gets used for |
| --- | --- | --- |
| A | Plaintiff | `file_case` + optional `judge_case` |
| B | Defendant | `submit_defense` |
| C | Spectator | `place_bet` + `claim_winnings` |

Three funded accounts make the full lifecycle testable. The faucet can top up
each of them with test GEN.

## Template fields

| Field | Contract parameter | Notes |
| --- | --- | --- |
| `title` | `file_case.title` | ≤ 200 chars after contract truncation; UI asks for 6+ |
| `description` | `file_case.description` | ≤ 5,000 chars; UI asks for 40+ |
| `evidence_urls` | `file_case.evidence_urls` | Comma-separated; pages are scraped (2,000 chars each) at judgment |
| `defense.text` | `submit_defense.defense_text` | `null` in `await-defense` templates |
| `defense.evidence_urls` | `submit_defense.defense_urls` | Comma-separated |
| `suggested_stakes` | `place_bet(case_id, outcome)` + value | Shapes an interesting pool; not binding |

## Stage labels

- **`full-cycle`** — includes a defense. File (A) → defend (B) → stake (C) →
  summon verdict → claim. Exercises every method.
- **`judge-now`** — includes a defense; ideal when you mainly want to watch
  the AI consensus run.
- **`await-defense`** — no defense attached. Perfect for practicing the
  defense step and for confirming that `judge_case` correctly reverts while
  the case is still `OPEN`.

## Walkthrough — full lifecycle on-chain

1. **File.** Open the dApp, *File a case*. Copy the template's title and
   description, set the defendant to wallet B, paste the evidence URLs
   comma-separated. Confirm in MetaMask. The case appears on the docket in
   `OPEN` state with an empty pool.
2. **Defend.** Switch MetaMask to wallet B, open the case, and the defense
   form appears (parties are detected from the contract record). Paste
   `defense.text` + URLs. Status flips to `DEFENSE`.
3. **Stake.** Switch to wallet C. Pick outcomes from `suggested_stakes`, enter
   the GEN amount, confirm. Pool bars update — note the escrow ledger on the
   contract grows by exactly the staked amount (`get_case_escrow`).
4. **Summon.** Any wallet presses *Summon verdict*. Validators scrape the
   linked pages, deliberate, and the case lands in `JUDGED` with verdict,
   severity (1–10) and reasoning. Staking is now closed (the contract rejects
   further `place_bet` calls).
5. **Claim.** Wallet C (if it backed the verdict) presses *Claim winnings* and
   receives its proportional share of the **entire pool** via a native GEN
   transfer emitted by the contract. The record flips to *Settled* and a
   second claim transaction reverts.

## Guard scenarios worth trying

| Experiment | Expected contract behavior |
| --- | --- |
| File with blank title / blank evidence | Reverts (`Title and description are required` / `At least one evidence URL is required`) |
| File against your own address | Reverts (`Cannot file a case against yourself`) |
| Defend from a wallet that is not the defendant | Reverts (`Only the defendant can submit a defense`) |
| Summon a verdict before any defense | Reverts (`Case must receive a defense before judgment`) |
| Stake from the plaintiff/defendant wallet | Reverts (`Plaintiff and defendant cannot bet on their own case`) |
| Stake 0 GEN | Reverts (`Bet requires sending GEN tokens (value > 0)`) |
| Stake a second time on a different outcome | Reverts (`You already bet on a different outcome for this case`) |
| Stake a second time on the same outcome | Succeeds — amounts add up |
| Claim before the verdict | Reverts (`Case has not been judged yet`) |
| Claim twice | Reverts (`Winnings already claimed`) |
| Claim from the losing side | Reverts on-chain after a 0-value payout calculation |

## Seeding many samples at once

Instead of filing templates by hand, run the scripted seeder — see
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md#seeding-the-docket):

```bash
DEPLOYER_PRIVATE_KEY=0xA… SECONDARY_PRIVATE_KEY=0xB… npx tsx deploy/seed.ts
```
