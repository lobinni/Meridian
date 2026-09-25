# Contract API — `contracts/meridian_tribunal.py`

Class: `MeridianTribunal` (GenLayer intelligent contract).

Deployed on GenLayer Studionet (chain 61999) at
[`0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97`](https://explorer-studio.genlayer.com/address/0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97).

All write methods revert with `gl.UserError` on guard failures. Amounts are
always native GEN in wei units.

## Write methods

### `file_case(defendant: Address, title: str, description: str, evidence_urls: str) -> u256`

Opens a new dispute and returns its id.

**Guards**

- Title, description and evidence URLs must be non-blank.
- The defendant cannot be the sender.

**Effects**

- Appends a `Case` with status `OPEN`, empty defense and verdict fields.
- Initializes the case escrow ledger to zero.

---

### `submit_defense(case_id: u256, defense_text: str, defense_urls: str) -> None`

The defendant mounts their defense.

**Guards**

- Case exists and is `OPEN`.
- Sender is the case defendant.
- Defense text is non-blank.

**Effects** — stores the defense (+ optional links) and transitions the case
to `DEFENSE`.

---

### `place_bet(case_id: u256, outcome: str)` — *payable*

Stakes native GEN (`gl.message.value`) on one of
`GUILTY` / `NOT_GUILTY` / `INSUFFICIENT_EVIDENCE`
(case-insensitive, spaces may replace underscores).

### `claim_winnings(case_id: u256) -> u256`

Settles the sender's position after judgment and returns the native GEN paid
out. See *Parimutuel math* in [ARCHITECTURE.md](ARCHITECTURE.md).

**Guards** — case `JUDGED`, verdict exists, sender holds a bet, not yet
claimed, contract balance covers the payout.

**Ordering** — `claimed` flips to `true` *before*
`_Recipient(sender).emit_transfer(value=winnings)` is emitted.

### `judge_case(case_id: u256) -> None`

Summons the AI tribunal. Callable by anyone once the defense is on record;
case transitions to `JUDGED` with a normalized verdict, severity (1–10) and
reasoning. Betting closes permanently for the case.

## View methods

| Method | Returns | Notes |
| --- | --- | --- |
| `get_case(case_id) -> dict` | Full case + `escrow` + `bet_totals{guilty, not_guilty, insufficient_evidence}` | Reverts if unknown id |
| `get_case_count() -> int` | Total filed cases | Sequential ids start at 0 |
| `get_all_cases() -> list` | Case summaries with `bet_totals` | Powers the docket + leaderboard |
| `get_bet(case_id, bettor) -> dict` | `{exists, bettor, case_id, outcome, amount, claimed}` | `exists=false` when absent |
| `get_case_bet_totals(case_id) -> dict` | The three pool buckets | Reverts if unknown id |
| `get_contract_balance() -> int` | Native GEN held by the contract | Escrow health check |
| `get_case_escrow(case_id) -> int` | GEN received for one case | Transparency ledger |

## Error reference

| Message | Raised by | Condition |
| --- | --- | --- |
| `Title and description are required` | `file_case` | Blank title/description |
| `At least one evidence URL is required` | `file_case` | Blank links |
| `Cannot file a case against yourself` | `file_case` | Defendant == sender |
| `Case not found` | all case-scoped calls | Unknown id |
| `Case is not open for defense` | `submit_defense` | Status ≠ OPEN |
| `Only the defendant can submit a defense` | `submit_defense` | Wrong sender |
| `Defense text is required` | `submit_defense` | Blank text |
| `Betting is closed — case already judged` | `place_bet` | Status JUDGED |
| `Bet requires sending GEN tokens (value > 0)` | `place_bet` | Zero value |
| `Plaintiff and defendant cannot bet on their own case` | `place_bet` | Party sender |
| `Invalid outcome…` | `place_bet` | Unknown outcome string |
| `You already bet on a different outcome for this case` | `place_bet` | Outcome switching |
| `Case has not been judged yet` | `claim_winnings` / workflow | Status ≠ JUDGED |
| `No verdict recorded` | `claim_winnings` | Empty verdict |
| `You have no bet on this case` | `claim_winnings` | Missing bet |
| `Winnings already claimed` | `claim_winnings` | Double claim |
| `Contract balance insufficient for payout — contact admin` | `claim_winnings` | Escrow shortfall |
| `Case already judged` | `judge_case` | Repeat judgment |
| `Case must receive a defense before judgment` | `judge_case` | Status still OPEN |
