export type OrderStatus = 'PENDING' | 'APPLIED' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'NOT_ALLOTTED' | 'ALLOTTED'
export type OrderCategory = 'RETAIL' | 'SHNI' | 'BHNI'

export interface IpoOrder {
  id: string
  ipo_id: string
  ipo_name: string
  account_id: string
  account_name: string
  category: OrderCategory
  lots: number
  amount: number
  status: OrderStatus
  angel_order_id: string
  placed_at: string
  reject_reason?: string
}
