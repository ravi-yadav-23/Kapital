from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.account import AccountResponse, AccountCreate, AccountUpdate
from app.services.account_service import account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=List[AccountResponse])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    """List all registered demat family accounts."""
    return await account_service.get_all_accounts(db)


@router.post("", response_model=AccountResponse)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db)):
    """Create a new family demat account."""
    return await account_service.create_account(db, data)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(account_id: str, data: AccountUpdate, db: AsyncSession = Depends(get_db)):
    """Update family demat account settings."""
    return await account_service.update_account(db, account_id, data)
