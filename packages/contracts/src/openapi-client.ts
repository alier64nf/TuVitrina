import type { CategorySchedule } from './cuba';
import type {
  CouponDiscountType,
  CurrencyCode,
  OrderPricingResult,
  PromotionRuleType,
} from './pricing';
import type {
  CreateCategoryInput,
  CreateCouponInput,
  CreateProductInput,
  CreatePromotionInput,
  CreateReportInput,
  CreateStoreOnboardingInput,
  CreateSubscriptionRequestInput,
  GuestCheckoutInput,
  ImportProductsCsvInput,
  ProductImageRef,
  QuoteOrderInput,
  ReorderCategoriesInput,
  ReorderProductsInput,
  ReviewReportInput,
  ReviewSubscriptionInput,
  SignedUploadRequestInput,
  StoreThemeConfig,
  SupportTicketInput,
  SyncProfileInput,
  UpdateBusinessProfileInput,
  UpdateCategoryInput,
  UpdateCouponInput,
  UpdateOrderStatusInput,
  UpdatePlansConfigInput,
  UpdateProductInput,
  UpdatePromotionInput,
  UpdateStoreStatusInput,
  UpdateSupportTicketStatusInput,
  UpdateUserProfileInput,
} from './schemas';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export class ApiProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiProblemError';
    this.problem = problem;
  }
}

export interface ProfileDto {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: 'seller' | 'support' | 'admin';
  termsVersion: string;
  acceptedTermsAt: string;
}

export interface StoreSummaryDto {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  whatsapp: string;
  telegram: string | null;
  province: string | null;
  municipality: string | null;
  streetAddress: string | null;
  hours: Record<string, unknown> | null;
  theme?: StoreThemeConfig | null;
  baseCurrency: CurrencyCode;
  acceptedCurrencies: CurrencyCode[];
  exchangeRates?: Record<string, number>;
  freeShippingMin?: number | null;
  pickupEnabled?: boolean;
  plan: 'free' | 'pro';
  planExpiresAt: string | null;
  daysUntilPlanExpiration?: number | null;
  status: 'active' | 'suspended';
  suspendedReason?: string | null;
  categoryCount: number;
  productCount: number;
  maxProductsAllowed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDto {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  active: boolean;
  schedule?: CategorySchedule | null;
  isAvailableNow?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  label: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceOverride: number | null;
  stock: number | null;
  active: boolean;
}

export interface ProductDto {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  currency: CurrencyCode;
  stock: number | null;
  active: boolean;
  soldOut: boolean;
  sortOrder: number;
  images: ProductImageRef[];
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProductsResponse {
  items: ProductDto[];
  nextCursor: string | null;
  totalCount: number;
}

export interface SignedUploadResponse {
  signedUrl: string;
  token: string;
  objectPath: string;
  publicUrl: string;
}

export interface CheckSlugResponse {
  slug: string;
  available: boolean;
  reason?: string;
}

export class TuVitrinaApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => Promise<string | null>,
  ) {}

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.auth !== false) {
      const token = await this.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;

    if (!res.ok) {
      const prob = (json && typeof json === 'object' ? json : {}) as Partial<ProblemDetails>;
      throw new ApiProblemError({
        type: prob.type || 'about:blank',
        title: prob.title || 'Error en la solicitud',
        status: prob.status || res.status,
        detail: prob.detail || `Error HTTP ${res.status}`,
        instance: prob.instance,
      });
    }

    return json as T;
  }

  getHealth() {
    return this.request<{ ok: boolean; postgres: string; redis: string }>('/api/v1/health', {
      auth: false,
    });
  }

  syncProfile(input: SyncProfileInput) {
    return this.request<{ profile: ProfileDto; store: StoreSummaryDto | null }>(
      '/api/v1/auth/sync-profile',
      { method: 'POST', body: input },
    );
  }

  getMe() {
    return this.request<{ profile: ProfileDto; store: StoreSummaryDto | null }>('/api/v1/users/me');
  }

  updateMe(input: UpdateUserProfileInput) {
    return this.request<{ profile: ProfileDto }>('/api/v1/users/me', {
      method: 'PATCH',
      body: input,
    });
  }

  checkSlug(slug: string) {
    return this.request<CheckSlugResponse>(
      `/api/v1/stores/check-slug?slug=${encodeURIComponent(slug)}`,
    );
  }

  createStore(input: CreateStoreOnboardingInput) {
    return this.request<StoreSummaryDto>('/api/v1/stores', {
      method: 'POST',
      body: input,
    });
  }

  getMyStore() {
    return this.request<StoreSummaryDto>('/api/v1/stores/me');
  }

  updateBusinessProfile(input: UpdateBusinessProfileInput) {
    return this.request<StoreSummaryDto>('/api/v1/stores/me/profile', {
      method: 'PATCH',
      body: input,
    });
  }

  listCategories() {
    return this.request<CategoryDto[]>('/api/v1/stores/me/categories');
  }

  createCategory(input: CreateCategoryInput) {
    return this.request<CategoryDto>('/api/v1/stores/me/categories', {
      method: 'POST',
      body: input,
    });
  }

  updateCategory(categoryId: string, input: UpdateCategoryInput) {
    return this.request<CategoryDto>(`/api/v1/stores/me/categories/${categoryId}`, {
      method: 'PATCH',
      body: input,
    });
  }

  reorderCategories(input: ReorderCategoriesInput) {
    return this.request<CategoryDto[]>('/api/v1/stores/me/categories/reorder', {
      method: 'PUT',
      body: input,
    });
  }

  deleteCategory(categoryId: string) {
    return this.request<{ deleted: boolean }>(`/api/v1/stores/me/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  listProducts(params?: { q?: string; categoryId?: string; cursor?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.categoryId) qs.set('categoryId', params.categoryId);
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<PaginatedProductsResponse>(`/api/v1/stores/me/products${suffix}`);
  }

  getProduct(productId: string) {
    return this.request<ProductDto>(`/api/v1/stores/me/products/${productId}`);
  }

  createProduct(input: CreateProductInput) {
    return this.request<ProductDto>('/api/v1/stores/me/products', {
      method: 'POST',
      body: input,
    });
  }

  updateProduct(productId: string, input: UpdateProductInput) {
    return this.request<ProductDto>(`/api/v1/stores/me/products/${productId}`, {
      method: 'PATCH',
      body: input,
    });
  }

  toggleSoldOut(productId: string, soldOut: boolean) {
    return this.request<ProductDto>(`/api/v1/stores/me/products/${productId}/sold-out`, {
      method: 'PATCH',
      body: { soldOut },
    });
  }

  duplicateProduct(productId: string) {
    return this.request<ProductDto>(`/api/v1/stores/me/products/${productId}/duplicate`, {
      method: 'POST',
    });
  }

  deleteProduct(productId: string) {
    return this.request<{ deleted: boolean }>(`/api/v1/stores/me/products/${productId}`, {
      method: 'DELETE',
    });
  }

  requestSignedUpload(input: SignedUploadRequestInput) {
    return this.request<SignedUploadResponse>('/api/v1/media/signed-upload', {
      method: 'POST',
      body: input,
    });
  }

  getStorefront(slug: string) {
    return this.request<StorefrontViewDto>(`/api/v1/storefronts/${slug}`, { auth: false });
  }

  placeOrder(slug: string, input: GuestCheckoutInput) {
    return this.request<CheckoutResponseDto>(`/api/v1/storefronts/${slug}/orders`, {
      method: 'POST',
      body: input,
      auth: false,
    });
  }

  trackOrder(slug: string, trackingToken: string) {
    return this.request<OrderDto>(`/api/v1/storefronts/${slug}/orders/track/${trackingToken}`, {
      auth: false,
    });
  }

  listSellerOrders(params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<OrderDto[]>(`/api/v1/stores/me/orders${suffix}`);
  }

  getSellerOrder(orderId: string) {
    return this.request<OrderDto>(`/api/v1/stores/me/orders/${orderId}`);
  }

  updateOrderStatus(orderId: string, input: UpdateOrderStatusInput) {
    return this.request<OrderDto>(`/api/v1/stores/me/orders/${orderId}/status`, {
      method: 'PATCH',
      body: input,
    });
  }

  // --- Subscripciones y Planes (Vendedor) ---
  getPlansConfig() {
    return this.request<PlansConfigDto>('/api/v1/plans/config', { auth: false });
  }

  requestProSubscription(input: CreateSubscriptionRequestInput) {
    return this.request<SubscriptionRequestDto>('/api/v1/stores/me/subscription', {
      method: 'POST',
      body: input,
    });
  }

  listMySubscriptions() {
    return this.request<SubscriptionRequestDto[]>('/api/v1/stores/me/subscriptions');
  }

  // --- Reportes (Tienda pública) ---
  reportStoreOrProduct(slug: string, input: CreateReportInput) {
    return this.request<{ reported: boolean }>(`/api/v1/storefronts/${slug}/reports`, {
      method: 'POST',
      body: input,
      auth: false,
    });
  }

  // --- Backoffice (Administrador y Soporte) ---
  adminGetMetrics() {
    return this.request<PlatformMetricsDto>('/api/v1/admin/metrics');
  }

  adminListStores(params?: { q?: string; status?: string; plan?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.plan) qs.set('plan', params.plan);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<StoreSummaryDto[]>(`/api/v1/admin/stores${suffix}`);
  }

  adminUpdateStoreStatus(storeId: string, input: UpdateStoreStatusInput) {
    return this.request<StoreSummaryDto>(`/api/v1/admin/stores/${storeId}/status`, {
      method: 'PATCH',
      body: input,
    });
  }

  adminListUsers(params?: { q?: string; role?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.role) qs.set('role', params.role);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<ProfileDto[]>(`/api/v1/admin/users${suffix}`);
  }

  adminListSubscriptions(params?: { status?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<SubscriptionRequestDto[]>(`/api/v1/admin/subscriptions${suffix}`);
  }

  adminReviewSubscription(id: string, input: ReviewSubscriptionInput) {
    return this.request<SubscriptionRequestDto>(`/api/v1/admin/subscriptions/${id}/review`, {
      method: 'PATCH',
      body: input,
    });
  }

  adminListReports(params?: { status?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<ReportDto[]>(`/api/v1/admin/reports${suffix}`);
  }

  adminReviewReport(id: string, input: ReviewReportInput) {
    return this.request<ReportDto>(`/api/v1/admin/reports/${id}/review`, {
      method: 'PATCH',
      body: input,
    });
  }

  adminListAuditLogs(params?: { entityType?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AuditLogDto[]>(`/api/v1/admin/audit-logs${suffix}`);
  }

  adminUpdatePlansConfig(input: UpdatePlansConfigInput) {
    return this.request<PlansConfigDto>('/api/v1/admin/plans-config', {
      method: 'PATCH',
      body: input,
    });
  }

  // --- Fase 5: Personalización, Cupones, Promociones, CSV, Analítica y Clientes ---
  updateStoreTheme(input: StoreThemeConfig) {
    return this.request<StoreSummaryDto>('/api/v1/stores/me/theme', {
      method: 'PATCH',
      body: input,
    });
  }

  reorderProducts(input: ReorderProductsInput) {
    return this.request<{ reordered: boolean }>('/api/v1/stores/me/products/reorder', {
      method: 'PUT',
      body: input,
    });
  }

  importProductsCsv(input: ImportProductsCsvInput) {
    return this.request<CsvImportResultDto>('/api/v1/stores/me/products/import-csv', {
      method: 'POST',
      body: input,
    });
  }

  listCoupons() {
    return this.request<CouponDto[]>('/api/v1/stores/me/coupons');
  }

  createCoupon(input: CreateCouponInput) {
    return this.request<CouponDto>('/api/v1/stores/me/coupons', {
      method: 'POST',
      body: input,
    });
  }

  updateCoupon(couponId: string, input: UpdateCouponInput) {
    return this.request<CouponDto>(`/api/v1/stores/me/coupons/${couponId}`, {
      method: 'PATCH',
      body: input,
    });
  }

  deleteCoupon(couponId: string) {
    return this.request<{ deleted: boolean }>(`/api/v1/stores/me/coupons/${couponId}`, {
      method: 'DELETE',
    });
  }

  listPromotions() {
    return this.request<PromotionDto[]>('/api/v1/stores/me/promotions');
  }

  createPromotion(input: CreatePromotionInput) {
    return this.request<PromotionDto>('/api/v1/stores/me/promotions', {
      method: 'POST',
      body: input,
    });
  }

  updatePromotion(promotionId: string, input: UpdatePromotionInput) {
    return this.request<PromotionDto>(`/api/v1/stores/me/promotions/${promotionId}`, {
      method: 'PATCH',
      body: input,
    });
  }

  deletePromotion(promotionId: string) {
    return this.request<{ deleted: boolean }>(`/api/v1/stores/me/promotions/${promotionId}`, {
      method: 'DELETE',
    });
  }

  quoteOrder(slug: string, input: QuoteOrderInput) {
    return this.request<OrderQuoteResponseDto>(`/api/v1/storefronts/${slug}/quote`, {
      method: 'POST',
      body: input,
      auth: false,
    });
  }

  getStoreAnalytics(period: '7d' | '30d' | '90d' | 'all' = '7d') {
    return this.request<StoreAnalyticsDto>(
      `/api/v1/stores/me/analytics?period=${encodeURIComponent(period)}`,
    );
  }

  async exportOrdersCsv(): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'text/csv',
    };
    const token = await this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl}/api/v1/stores/me/orders/export-csv`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new ApiProblemError({
        type: 'about:blank',
        title: 'Error exportando pedidos',
        status: res.status,
        detail: `Error HTTP ${res.status}`,
      });
    }
    return res.text();
  }

  listCustomers(q?: string) {
    const suffix = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.request<CustomerSummaryDto[]>(`/api/v1/stores/me/customers${suffix}`);
  }

  // --- Fase 6: Soporte ---
  createSupportTicket(input: SupportTicketInput) {
    return this.request<CreateSupportTicketResponseDto>('/api/v1/support/tickets', {
      method: 'POST',
      body: input,
      auth: false,
    });
  }

  adminListSupportTickets(params?: { status?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<SupportTicketDto[]>(`/api/v1/admin/support-tickets${suffix}`);
  }

  adminUpdateSupportTicketStatus(id: string, input: UpdateSupportTicketStatusInput) {
    return this.request<SupportTicketDto>(`/api/v1/admin/support-tickets/${id}`, {
      method: 'PATCH',
      body: input,
    });
  }
}

export interface StorefrontPaymentMethodDto {
  id: string;
  type: string;
  label: string;
  currencies: CurrencyCode[];
  instructions: string | null;
  accountData: string | null;
}

export interface StorefrontPromotionDto {
  id: string;
  name: string;
  type: PromotionRuleType;
  discountValue: number;
  minAmount: number;
  categoryId: string | null;
  productIds: string[];
}

export interface StorefrontShippingZoneDto {
  id: string;
  province: string;
  municipality: string | null;
  cost: number;
  currency: CurrencyCode;
}

export interface StorefrontViewDto {
  store: StoreSummaryDto;
  isOpen: boolean;
  categories: CategoryDto[];
  products: ProductDto[];
  paymentMethods: StorefrontPaymentMethodDto[];
  promotions?: StorefrontPromotionDto[];
  shippingZones?: StorefrontShippingZoneDto[];
}

export interface OrderItemDto {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  currency: CurrencyCode;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryDto {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  storeId: string;
  orderNumber: number;
  trackingToken: string;
  status: string;
  paymentStatus: string;
  channel: string;
  paymentLabel: string;
  fulfillmentType: string;
  shippingZoneName: string | null;
  customerSnapshot: {
    customerName: string;
    phone: string;
    province: string;
    municipality: string;
    streetAddress: string;
    notes?: string | null;
  };
  currency: CurrencyCode;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  couponCode: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
  statusHistory: OrderStatusHistoryDto[];
}

export interface CheckoutResponseDto {
  order: OrderDto;
  whatsappUrl: string;
  telegramUrl: string | null;
  messageText: string;
}

export interface PlansConfigDto {
  key: string;
  freeLimits: {
    maxProducts: number;
    maxImagesPerProduct: number;
    maxCategories: number;
  };
  proLimits: {
    maxProducts: number;
    maxImagesPerProduct: number;
    maxCategories: number;
  };
  proPriceCup: number;
  proPriceUsd: number;
  proDurationDays: number;
  paymentInstructions: string;
}

export interface SubscriptionRequestDto {
  id: string;
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  profileId: string;
  targetPlan: 'free' | 'pro';
  durationDays: number;
  amount: number;
  currency: CurrencyCode;
  paymentMethodLabel: string;
  reference: string;
  receiptObjectKey: string;
  receiptPublicUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDto {
  id: string;
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  productId: string | null;
  productName?: string;
  targetType: 'store' | 'product';
  reason: string;
  details: string;
  reporterContact: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolutionNote: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PlatformMetricsDto {
  activeStores: number;
  suspendedStores: number;
  totalOrders: number;
  totalUsers: number;
  freeStores: number;
  proStores: number;
  conversionFreeToProPercent: number;
  pendingSubscriptionsCount: number;
  openReportsCount: number;
}

export interface CouponDto {
  id: string;
  storeId: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  currency: CurrencyCode;
  minOrderAmount: number;
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionDto {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  type: PromotionRuleType;
  discountValue: number;
  minAmount: number;
  productIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderQuoteResponseDto {
  pricing: OrderPricingResult;
  shippingZoneName: string | null;
  couponApplied: string | null;
  couponError: string | null;
}

export interface StoreAnalyticsDto {
  period: '7d' | '30d' | '90d' | 'all';
  currency: CurrencyCode;
  ordersCount: number;
  cancelledOrdersCount: number;
  totalRevenue: number;
  averageTicket: number;
  visitsCount: number;
  conversionRatePercent: number;
  topProducts: Array<{
    productId: string | null;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  paymentMethodsBreakdown: Array<{
    paymentLabel: string;
    ordersCount: number;
    revenue: number;
  }>;
  dailySeries: Array<{
    date: string;
    visits: number;
    ordersCount: number;
    revenue: number;
  }>;
}

export interface CustomerSummaryDto {
  phone: string;
  customerName: string;
  province: string;
  municipality: string;
  ordersCount: number;
  totalSpent: number;
  currency: CurrencyCode;
  lastOrderAt: string;
  orders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    total: number;
    currency: CurrencyCode;
    createdAt: string;
  }>;
}

export interface CsvImportErrorRow {
  row: number;
  field: string;
  message: string;
}

export interface CsvImportResultDto {
  importedCount: number;
  skippedCount: number;
  errors: CsvImportErrorRow[];
}

export interface SupportTicketDto {
  id: string;
  name: string;
  contact: string;
  channel: 'whatsapp' | 'telegram' | 'email';
  storeSlug: string | null;
  topic: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketResponseDto {
  ticket: SupportTicketDto;
  referenceCode: string;
}

