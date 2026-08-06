export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string | null
  additionalOptions?: { name: string; price: number; quantity: number }[]
}

export interface OrderFormData {
  customerName: string
  customerPhone: string
  customerAddress: string
  notes?: string
}
