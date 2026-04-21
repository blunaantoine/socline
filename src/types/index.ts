// User types
export type UserRole = 'CLIENT' | 'WASHER' | 'ADMIN';

export interface Vehicle {
  plateNumber: string;
  color: string;
  model?: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  vehicle?: Vehicle;
  plateNumber?: string;
  carColor?: string;
  pin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Washer {
  id: string;
  userId: string;
  user: User;
  isAvailable: boolean;
  isVerified: boolean;
  rating: number;
  totalRatings: number;
  totalEarnings: number;
  completedJobs: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  idDocument?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  bankName?: string;
  bankAccount?: string;
  stationId?: string;
  station?: Station;
  createdAt: string;
  updatedAt: string;
}

export interface Station {
  id: string;
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  images?: string[];
  rating: number;
  totalRatings: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number; // in minutes
  image?: string;
  category: string;
  isActive: boolean;
  stationId?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'WALLET' | 'CASH';

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  client: User;
  washerId?: string;
  washer?: Washer;
  serviceId: string;
  service: Service;
  stationId?: string;
  station?: Station;
  isHomeService: boolean;
  address: string;
  latitude?: number;
  longitude?: number;
  vehiclePlate?: string;
  vehicleColor?: string;
  basePrice: number;
  discount: number;
  promoCode?: string;
  totalPrice: number;
  commission: number;
  status: OrderStatus;
  scheduledAt?: string;
  estimatedArrival?: string;
  acceptedAt?: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  payment?: Payment;
  review?: Review;
}

export interface Payment {
  id: string;
  orderId: string;
  order: Order;
  userId: string;
  user: User;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  order: Order;
  clientId: string;
  client: User;
  washerId?: string;
  stationId?: string;
  rating: number;
  comment?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TrackingEvent {
  id: string;
  orderId: string;
  event: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  createdAt: string;
}

export type PromotionType = 'GLOBAL' | 'TARGETED' | 'PROMO_CODE';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: PromotionType;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  code?: string;
  startDate: string;
  endDate: string;
  maxUses?: number;
  currentUses: number;
  maxUsesPerUser: number;
  targetUserIds?: string[];
  minOrderAmount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  user: User;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard stats
export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalClients: number;
  totalWashers: number;
  activeOrders: number;
  pendingOrders: number;
  completedOrders: number;
  todayRevenue: number;
  todayOrders: number;
}

// Location types
export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

// Marker types for map
export interface MapMarker {
  id: string;
  type: 'USER' | 'WASHER' | 'STATION';
  latitude: number;
  longitude: number;
  label?: string;
  data?: Washer | Station;
}

// Message types
export type MessageType = 'TEXT' | 'IMAGE' | 'LOCATION' | 'QUICK_MESSAGE' | 'SYSTEM';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  receiverId: string;
  receiver: User;
  type: MessageType;
  content: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  quickType?: string; // "ARRIVING", "ON_SITE", "DELAY"
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  orderId: string;
  order: Order;
  clientId: string;
  washerId?: string;
  isActive: boolean;
  isLocked: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

// Chat store types
export interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
}
