import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger("bank_service")

# Regex for standard Indian UPI VPAs (e.g. username@okhdfcbank, mobile@paytm)
UPI_VPA_REGEX = re.compile(r"^[\w\.\-]{2,256}@[a-zA-Z]{2,64}$")

SUPPORTED_ASBA_BANKS = [
    {"code": "HDFC", "name": "HDFC Bank", "upi_handles": ["okhdfcbank", "hdfcbank"]},
    {"code": "ICICI", "name": "ICICI Bank", "upi_handles": ["okicici", "icici"]},
    {"code": "SBI", "name": "State Bank of India", "upi_handles": ["oksbi", "sbi"]},
    {"code": "AXIS", "name": "Axis Bank", "upi_handles": ["okaxis", "axisbank"]},
    {"code": "KOTAK", "name": "Kotak Mahindra Bank", "upi_handles": ["kotak"]},
    {"code": "PNB", "name": "Punjab National Bank", "upi_handles": ["pnb"]},
]


class BankService:
    """
    ASBA Banking & UPI Mandate Verification Service.
    Enforces SEBI bidding limits per category and validates UPI VPA handles.
    """

    @staticmethod
    def validate_upi_vpa(vpa: str) -> bool:
        """Validates that a UPI Virtual Payment Address matches standard NPCI format."""
        if not vpa or not isinstance(vpa, str):
            return False
        return bool(UPI_VPA_REGEX.match(vpa.strip()))

    @staticmethod
    def get_supported_banks() -> List[Dict[str, Any]]:
        """List verified SCSB (Self Certified Syndicate Banks) with 100% UPI ASBA support."""
        return SUPPORTED_ASBA_BANKS

    @staticmethod
    def check_asba_category_limits(category: str, amount: float) -> Dict[str, Any]:
        """
        Validates bid amount against SEBI ASBA bidding category boundaries (SEBI ICDR Regulations):
        - RETAIL: Up to ₹2,00,000. UPI mandate supported up to ₹5,00,000 (payment limit, not category limit).
        - sHNI:   ₹2,00,001 to ₹10,00,000 (Small Non-Institutional Investor).
        - bHNI:   Above ₹10,00,000 (Big Non-Institutional Investor — requires Netbanking / Syndicate ASBA).
        """
        cat = category.upper()
        if cat == "RETAIL":
            if amount > 200000:
                return {
                    "valid": False,
                    "message": f"Retail category bid cannot exceed ₹2,00,000 (requested ₹{amount:,.2f}).",
                }
            return {"valid": True, "message": "Valid Retail application."}

        elif cat == "SHNI":
            if amount <= 200000:
                return {
                    "valid": False,
                    "message": f"sHNI category bid must exceed ₹2,00,000 (requested ₹{amount:,.2f}).",
                }
            if amount > 1000000:
                return {
                    "valid": False,
                    "message": f"sHNI category bid cannot exceed ₹10,00,000 (requested ₹{amount:,.2f}). Use bHNI category instead.",
                }
            return {"valid": True, "message": "Valid sHNI application."}

        elif cat == "BHNI":
            if amount <= 1000000:
                return {
                    "valid": False,
                    "message": f"bHNI category bid must exceed ₹10,00,000 (requested ₹{amount:,.2f}). Use sHNI for amounts up to ₹10L.",
                }
            return {"valid": True, "message": "Valid bHNI application."}

        return {"valid": False, "message": f"Unknown bidding category '{category}'."}


bank_service = BankService()
