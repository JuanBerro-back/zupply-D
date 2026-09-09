export interface User {
  id: number;
  username: string;
  name?: string;
  role: string;
  role_id: number;
  restaurant_id: number | null;
  supplier_id: number | null;
  branch_id: number | null;
  phone?: string | null;
  email?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  nit: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  rating: string | number;
  review_count: number;
  logo_url: string;
  is_active: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  nit: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  department: string;
  logo_url: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  sku: string;
  unit: string;
  price_per_unit: number;
  min_order_qty: number;
  stock_available: number;
  image_url: string;
  category: string;
  category_id: number;
  supplier_id: number;
  supplier_name: string;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  order_code: string;
  restaurant_id: number;
  restaurant_name: string;
  supplier_id: number;
  supplier_name: string;
  status: string;
  total: number;
  notes: string;
  delivery_address: string;
  requested_delivery_date: string;
  confirmed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_by: number;
  created_at: string;
  supplier_email?: string;
  restaurant_email?: string;
  items: OrderItem[];
  deliveries?: Delivery[];
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  avg_daily_usage: number;
  cost_per_unit: number;
  expiry_date: string;
  stock_status: 'critical' | 'low' | 'normal';
  supplier_id: number;
  supplier_name: string;
}

export interface Invoice {
  id: number;
  invoice_code: string;
  mode: string;
  restaurant_id: number;
  restaurant_name: string;
  supplier_id: number;
  supplier_name: string;
  order_id: number;
  client_name: string;
  client_email: string;
  subtotal: number;
  iva_amount: number;
  impoconsumo_amount: number;
  total: number;
  payment_method: string;
  status: string;
  issued_at: string;
  created_at: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Review {
  id: number;
  supplier_id: number;
  supplier_name: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface AccountingTransaction {
  id: number;
  type: 'ingreso' | 'egreso';
  amount: number;
  description: string;
  category: string;
  payment_method: string;
  transaction_date: string;
}

export interface Delivery {
  id: number;
  delivery_code: string;
  order_id: number;
  order_code: string;
  vehicle_id: number;
  vehicle_name: string;
  vehicle_type?: string;
  plate: string;
  vehicle_lat?: number | null;
  vehicle_lng?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  last_location_update?: string | null;
  imei?: string | null;
  gps_validated?: boolean;
  gps_last_seen?: string | null;
  driver_id?: number | null;
  driver_name: string;
  driver_phone?: string | null;
  restaurant_phone?: string | null;
  notes?: string | null;
  confirmation_code?: string | null;
  restaurant_name: string;
  delivery_address: string;
  status: 'asignado' | 'en_camino' | 'llegando' | 'entregado' | 'fallido';
  scheduled_time: string;
  actual_delivery_time: string;
  created_at: string;
  items: DeliveryItem[];
}

export interface DeliveryItem {
  id: number;
  product_name: string;
  quantity: number;
  unit: string;
}

export interface Vehicle {
  id: number;
  name: string;
  plate: string;
  type: string;
  driver_id?: number | null;
  driver_name: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  imei?: string | null;
  gps_validated?: boolean;
  gps_last_seen?: string | null;
}

export interface Notification {
  message: string;
  at: string;
}

export interface TenantInfo {
  type: 'restaurant' | 'supplier' | 'platform';
  id?: number;
  name: string;
  logo_url?: string;
}