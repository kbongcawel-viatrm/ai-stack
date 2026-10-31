from pathlib import Path
import pytest
from php_patch.inventory import load_fixtures
from php_patch.policy import load_policy, select_targets, validate_policy

ROOT = Path(__file__).resolve().parents[1]

def test_fixture_inventory_has_both_clouds():
    items = load_fixtures(ROOT / "fixtures")
    assert {item.cloud for item in items} == {"aws", "azure"}
    assert all(item.php_version == "8.3.12" for item in items)

def test_policy_is_valid():
    validate_policy(load_policy(ROOT / "config/php-policy.yml"))

def test_target_selection_requires_all_filters():
    with pytest.raises(ValueError):
        select_targets(load_fixtures(ROOT / "fixtures"), bu="BU-DEMO",
                       environment="development", patch_ring="")

def test_target_selection_matches_exact_scope():
    selected = select_targets(load_fixtures(ROOT / "fixtures"), bu="BU-DEMO",
                              environment="development", patch_ring="canary")
    assert len(selected) == 2
