"""F31: crypto fails closed; PAN is validated and a masked PAN can never overwrite a real one."""
import pytest
from pydantic import ValidationError

from app.schemas.account import AccountCreate, AccountUpdate
from app.utils import security


def test_encrypt_fails_closed_instead_of_returning_plaintext(monkeypatch):
    def broken():
        raise RuntimeError("bad key")

    monkeypatch.setattr(security, "_get_cipher", broken)
    with pytest.raises(Exception):
        security.encrypt_credential("my-secret-pin")


def test_encrypt_roundtrip_still_works():
    enc = security.encrypt_credential("1234-pin")
    assert enc.startswith("enc:") and "1234-pin" not in enc
    assert security.decrypt_credential(enc) == "1234-pin"


@pytest.mark.parametrize("bad", ["A*****234F", "ABCDE1234", "abcde12345", "12345ABCDE", "ABCDE1234FG", "A B"])
def test_invalid_or_masked_pan_rejected_on_update(bad):
    with pytest.raises(ValidationError):
        AccountUpdate(pan=bad)


@pytest.mark.parametrize("bad", ["A*****234F", "ABCDE1234", "ABCD11234F"])
def test_invalid_or_masked_pan_rejected_on_create(bad):
    with pytest.raises(ValidationError):
        AccountCreate(name="n", angel_client_id="C1", pan=bad)


def test_valid_pan_is_normalised_to_upper_case():
    assert AccountUpdate(pan=" abcde1234f ").pan == "ABCDE1234F"
    assert AccountCreate(name="n", angel_client_id="C1", pan="abcde1234f").pan == "ABCDE1234F"


def test_blank_pan_clears_and_none_is_untouched():
    assert AccountUpdate(pan="").pan == ""
    assert AccountUpdate().pan is None
    assert AccountCreate(name="n", angel_client_id="C1").pan is None
