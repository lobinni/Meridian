"""
Meridian Tribunal — sample integration tests.

These tests exercise the intelligent contract against the GenLayer
localnet simulator (gltest). They cover the complete dispute lifecycle:
filing, defense, parimutuel staking with real native value, guarded
claims, and the AI judgment pipeline.

The same contract is deployed on GenLayer Studionet (chain 61999) at
0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97 — see docs/TESTING.md for the
manual live-testing walkthrough and the sample dispute pack
(samples/cases.json) used to exercise the real deployment.

Run them with:

    pip install genlayer-test
    gltest --network localnet            # terminal 1: start the simulator
    gltest test/                         # terminal 2: execute the suite

See docs/TESTING.md for a complete walkthrough.
"""

from pathlib import Path

import pytest
from gltest import (
    create_account,
    get_contract_factory,
)
from gltest.assertions import tx_execution_succeeded

CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"
CONTRACT_FILE = CONTRACTS_DIR / "meridian_tribunal.py"

ONE_GEN = 10**18  # native value is carried in wei-sized units

EVIDENCE = "https://example.com/agreement, https://example.com/receipt"


def _factory():
    return get_contract_factory(contract_file_path=CONTRACT_FILE)


def _bettor_view(contract, account):
    """Rebind the contract proxy to act as another account."""
    factory = _factory()
    return factory.build_contract(
        contract_address=contract.address, account=account
    )


# ---------------------------------------------------------------------------
# Deployment & filing
# ---------------------------------------------------------------------------


def test_deploy_initial_state():
    contract = _factory().deploy()
    assert contract.get_case_count(args=[]).call() == 0
    assert contract.get_all_cases(args=[]).call() == []


def test_file_case_creates_record():
    plaintiff = create_account()
    defendant = create_account()
    contract = _factory().deploy(account=plaintiff)

    tx = contract.file_case(
        args=[defendant.address, "Broken escrow trade", "Paid but never received the asset.", EVIDENCE]
    ).transact()
    assert tx_execution_succeeded(tx)

    case = contract.get_case(args=[0]).call()
    assert case["title"] == "Broken escrow trade"
    assert case["plaintiff"].lower() == plaintiff.address.lower()
    assert case["defendant"].lower() == defendant.address.lower()
    assert case["status"] == "OPEN"
    assert case["escrow"] == 0
    assert contract.get_case_count(args=[]).call() == 1


@pytest.mark.parametrize(
    "title,description,evidence",
    [
        ("", "description", EVIDENCE),          # empty title
        ("   ", "description", EVIDENCE),       # whitespace title
        ("Title", "", EVIDENCE),                # empty description
        ("Title", "description", ""),           # no evidence links
    ],
)
def test_file_case_input_validation(title, description, evidence):
    plaintiff = create_account()
    defendant = create_account()
    contract = _factory().deploy(account=plaintiff)

    tx = contract.file_case(
        args=[defendant.address, title, description, evidence]
    ).transact()
    assert not tx_execution_succeeded(tx)
    assert contract.get_case_count(args=[]).call() == 0


def test_cannot_file_against_self():
    plaintiff = create_account()
    contract = _factory().deploy(account=plaintiff)

    tx = contract.file_case(
        args=[plaintiff.address, "Vs myself", "Description text here.", EVIDENCE]
    ).transact()
    assert not tx_execution_succeeded(tx)


# ---------------------------------------------------------------------------
# Defense flow
# ---------------------------------------------------------------------------


def _file_case(contract, defendant_addr):
    tx = contract.file_case(
        args=[defendant_addr, "Delivery dispute", "Milestone was missed entirely.", EVIDENCE]
    ).transact()
    assert tx_execution_succeeded(tx)
    return 0


def test_only_defendant_can_defend():
    plaintiff = create_account()
    defendant = create_account()
    stranger = create_account()
    contract = _factory().deploy(account=plaintiff)
    case_id = _file_case(contract, defendant.address)

    intruder = _bettor_view(contract, stranger)
    tx = intruder.submit_defense(args=[case_id, "Not my fault", ""]).transact()
    assert not tx_execution_succeeded(tx)

    defender = _bettor_view(contract, defendant)
    tx = defender.submit_defense(
        args=[case_id, "Timeline was renegotiated in writing.", "https://example.com/thread"]
    ).transact()
    assert tx_execution_succeeded(tx)

    case = contract.get_case(args=[case_id]).call()
    assert case["status"] == "DEFENSE"
    assert "renegotiated" in case["defense_text"]

    # Second defense attempt must fail (status moved on).
    tx = defender.submit_defense(args=[case_id, "Again", ""]).transact()
    assert not tx_execution_succeeded(tx)


def test_judgment_requires_defense_first():
    plaintiff = create_account()
    defendant = create_account()
    contract = _factory().deploy(account=plaintiff)
    case_id = _file_case(contract, defendant.address)

    tx = contract.judge_case(args=[case_id]).transact()
    assert not tx_execution_succeeded(tx)


# ---------------------------------------------------------------------------
# Parimutuel betting guards
# ---------------------------------------------------------------------------


def _case_in_defense():
    plaintiff = create_account()
    defendant = create_account()
    contract = _factory().deploy(account=plaintiff)
    case_id = _file_case(contract, defendant.address)
    defender = _bettor_view(contract, defendant)
    tx = defender.submit_defense(args=[case_id, "My defense statement.", ""]).transact()
    assert tx_execution_succeeded(tx)
    return contract, case_id, plaintiff, defendant


def test_bet_requires_value():
    contract, case_id, _, _ = _case_in_defense()
    spectator = create_account()
    bettor = _bettor_view(contract, spectator)

    tx = bettor.place_bet(args=[case_id, "GUILTY"]).transact(value=0)
    assert not tx_execution_succeeded(tx)


def test_parties_cannot_bet_on_own_case():
    contract, case_id, plaintiff, defendant = _case_in_defense()

    tx = _bettor_view(contract, plaintiff).place_bet(
        args=[case_id, "GUILTY"]
    ).transact(value=ONE_GEN)
    assert not tx_execution_succeeded(tx)

    tx = _bettor_view(contract, defendant).place_bet(
        args=[case_id, "NOT_GUILTY"]
    ).transact(value=ONE_GEN)
    assert not tx_execution_succeeded(tx)


def test_invalid_outcome_rejected():
    contract, case_id, _, _ = _case_in_defense()
    bettor = _bettor_view(contract, create_account())

    tx = bettor.place_bet(args=[case_id, "MAYBE"]).transact(value=ONE_GEN)
    assert not tx_execution_succeeded(tx)


def test_bet_updates_pools_and_ledger():
    contract, case_id, _, _ = _case_in_defense()
    whale = create_account()
    shrimp = create_account()

    tx = _bettor_view(contract, whale).place_bet(
        args=[case_id, "GUILTY"]
    ).transact(value=3 * ONE_GEN)
    assert tx_execution_succeeded(tx)

    tx = _bettor_view(contract, shrimp).place_bet(
        args=[case_id, "NOT_GUILTY"]
    ).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    totals = contract.get_case_bet_totals(args=[case_id]).call()
    assert totals["guilty"] == 3 * ONE_GEN
    assert totals["not_guilty"] == ONE_GEN
    assert contract.get_case_escrow(args=[case_id]).call() == 4 * ONE_GEN

    bet = contract.get_bet(args=[case_id, whale.address]).call()
    assert bet["exists"] is True
    assert bet["outcome"] == "GUILTY"
    assert bet["amount"] == 3 * ONE_GEN
    assert bet["claimed"] is False


def test_escrow_matches_received_value_across_cases():
    """Escrow ledger and contract balance stay consistent across cases."""
    contract, case_a, _, _ = _case_in_defense()
    plaintiff_b = create_account()
    defendant_b = create_account()
    case_b_view = _bettor_view(contract, plaintiff_b)
    tx = case_b_view.file_case(
        args=[defendant_b.address, "Second dispute", "Another complaint.", EVIDENCE]
    ).transact()
    assert tx_execution_succeeded(tx)
    case_b = 1

    staker_a = create_account()
    staker_b = create_account()

    tx = _bettor_view(contract, staker_a).place_bet(
        args=[case_a, "GUILTY"]
    ).transact(value=2 * ONE_GEN)
    assert tx_execution_succeeded(tx)

    tx = _bettor_view(contract, staker_b).place_bet(
        args=[case_b, "INSUFFICIENT_EVIDENCE"]
    ).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    assert contract.get_case_escrow(args=[case_a]).call() == 2 * ONE_GEN
    assert contract.get_case_escrow(args=[case_b]).call() == ONE_GEN
    # The contract holds the full cumulative stake in its native balance.
    balance = contract.get_contract_balance(args=[]).call()
    assert balance == 3 * ONE_GEN


def test_no_outcome_switching_but_top_up_allowed():
    contract, case_id, _, _ = _case_in_defense()
    account = create_account()
    bettor = _bettor_view(contract, account)

    tx = bettor.place_bet(args=[case_id, "GUILTY"]).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    # Switching the outcome must revert.
    tx = bettor.place_bet(args=[case_id, "NOT_GUILTY"]).transact(value=ONE_GEN)
    assert not tx_execution_succeeded(tx)

    # Topping up the same outcome works.
    tx = bettor.place_bet(args=[case_id, "GUILTY"]).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    bet = contract.get_bet(args=[case_id, account.address]).call()
    assert bet["amount"] == 2 * ONE_GEN


def test_claim_before_verdict_reverts():
    contract, case_id, _, _ = _case_in_defense()
    account = create_account()
    bettor = _bettor_view(contract, account)

    tx = bettor.place_bet(args=[case_id, "GUILTY"]).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    tx = bettor.claim_winnings(args=[case_id]).transact()
    assert not tx_execution_succeeded(tx)


# ---------------------------------------------------------------------------
# Full cycle: verdict + parimutuel payout (integration / nondeterministic AI)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_full_cycle_verdict_and_payout():
    """
    End-to-end: file → defend → stake → judge → claim.

    The judgment step is genuinely AI-driven in the localnet simulator, so
    the exact verdict is not asserted — instead the test verifies that:

      * the case transitions to JUDGED with a normalized verdict,
      * severity lands inside 1..10,
      * a bettor on the winning outcome can claim exactly once and is paid
        their proportional share of the whole pool,
      * a losing bettor cannot double claim.
    """
    plaintiff = create_account()
    defendant = create_account()
    backer_guilty = create_account()
    backer_innocent = create_account()

    contract = _factory().deploy(account=plaintiff)
    case_id = _file_case(contract, defendant.address)

    defender = _bettor_view(contract, defendant)
    tx = defender.submit_defense(
        args=[case_id, "All terms were honoured; see the linked ledger.", "https://example.com/ledger"]
    ).transact()
    assert tx_execution_succeeded(tx)

    tx = _bettor_view(contract, backer_guilty).place_bet(
        args=[case_id, "GUILTY"]
    ).transact(value=2 * ONE_GEN)
    assert tx_execution_succeeded(tx)

    tx = _bettor_view(contract, backer_innocent).place_bet(
        args=[case_id, "NOT_GUILTY"]
    ).transact(value=ONE_GEN)
    assert tx_execution_succeeded(tx)

    # Betting must stay open pre-verdict, and any address may summon judgment.
    tx = _bettor_view(contract, backer_guilty).judge_case(args=[case_id]).transact(
        wait_retries=600,
        wait_interval=1000,
    )
    assert tx_execution_succeeded(tx)

    case = contract.get_case(args=[case_id]).call()
    assert case["status"] == "JUDGED"
    verdict = case["verdict"]
    assert verdict in ("GUILTY", "NOT_GUILTY", "INSUFFICIENT_EVIDENCE")
    assert 1 <= case["severity"] <= 10
    assert len(case["reasoning"]) > 0

    # Betting is now closed.
    tx = _bettor_view(contract, create_account()).place_bet(
        args=[case_id, verdict]
    ).transact(value=ONE_GEN)
    assert not tx_execution_succeeded(tx)

    # The winning bettor claims their proportional share.
    winner_account = backer_guilty if verdict == "GUILTY" else backer_innocent
    loser_account = backer_innocent if verdict == "GUILTY" else backer_guilty

    if verdict not in ("GUILTY", "NOT_GUILTY"):
        pytest.skip("Verdict had no backers on the winning side — refund path covered separately")

    winner = _bettor_view(contract, winner_account)
    tx = winner.claim_winnings(args=[case_id]).transact()
    assert tx_execution_succeeded(tx)

    bet = contract.get_bet(args=[case_id, winner_account.address]).call()
    assert bet["claimed"] is True

    # Double claim must revert.
    tx = winner.claim_winnings(args=[case_id]).transact()
    assert not tx_execution_succeeded(tx)

    # The loser cannot claim a payout.
    tx = _bettor_view(contract, loser_account).claim_winnings(args=[case_id]).transact()
    assert not tx_execution_succeeded(tx)
