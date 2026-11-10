import pytest
from php_patch.models import classify

def test_patch_update_same_branch():
    result = classify("8.3.12", "8.3.14")
    assert result.change_type == "minor-security"
    assert result.allowed_as_minor

def test_branch_upgrade_requires_migration():
    result = classify("8.3.12", "8.4.0")
    assert result.change_type == "major-minor-upgrade"
    assert not result.allowed_as_minor

def test_downgrade_rejected():
    with pytest.raises(ValueError):
        classify("8.3.12", "8.3.10")

@pytest.mark.parametrize("version", ["8.3", "v8.3.1", "8.x.1", ""])
def test_invalid_version_rejected(version):
    with pytest.raises(ValueError):
        classify(version, "8.3.13")
