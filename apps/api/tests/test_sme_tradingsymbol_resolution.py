import pytest
from app.services.angel_service import angel_service


def test_preserve_existing_series_suffix():
    """If symbol is already qualified (e.g. BLSPOLYMER-SM), it must not become BLSPOLYMER-SM-EQ."""
    res_sm = angel_service.resolve_tradingsymbol("BLSPOLYMER-SM", exchange="NSE")
    assert res_sm == "BLSPOLYMER-SM"

    res_st = angel_service.resolve_tradingsymbol("KRN-ST", exchange="NSE")
    assert res_st == "KRN-ST"

    res_eq = angel_service.resolve_tradingsymbol("RELIANCE-EQ", exchange="NSE")
    assert res_eq == "RELIANCE-EQ"


def test_mainline_symbol_defaults_to_eq():
    """Clean mainline NSE symbol without suffix defaults to -EQ."""
    res = angel_service.resolve_tradingsymbol("RELIANCE", exchange="NSE")
    assert res == "RELIANCE-EQ"


def test_bse_symbol_remains_clean():
    """BSE symbols do not append -EQ."""
    res = angel_service.resolve_tradingsymbol("500325", exchange="BSE")
    assert res == "500325"
