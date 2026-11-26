-- Migración inicial de TuVitrina (PostgreSQL + RLS estricto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE "UserRole" AS ENUM ('seller', 'support', 'admin');
CREATE TYPE "StorePlan" AS ENUM ('free', 'pro');
CREATE TYPE "StoreStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "CurrencyCode" AS ENUM ('CUP', 'USD', 'MLC');
CREATE TYPE "OrderChannel" AS ENUM ('whatsapp', 'telegram');
CREATE TYPE "OrderStatus" AS ENUM ('created', 'confirmed', 'preparing', 'dispatched', 'delivered', 'cancelled');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'proof_submitted', 'paid', 'failed', 'refunded');
CREATE TYPE "PaymentMethodType" AS ENUM ('cash', 'transfermovil', 'enzona', 'bank_transfer', 'other');
CREATE TYPE "PaymentProviderType" AS ENUM ('manual', 'enzona', 'transfermovil');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('pending', 'authorized', 'completed', 'failed', 'cancelled', 'refunded');
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');
CREATE TYPE "PromotionType" AS ENUM ('percent', 'min_amount', 'bogo_2x1', 'bogo_3x2', 'second_unit', 'combo');
CREATE TYPE "ReportTargetType" AS ENUM ('store', 'product');
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- Tablas
CREATE TABLE "profiles" (
  "id" UUID NOT NULL,
  "email" VARCHAR(160) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(24),
  "role" "UserRole" NOT NULL DEFAULT 'seller',
  "terms_version" VARCHAR(32) NOT NULL,
  "accepted_terms_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

CREATE TABLE "stores" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "slug" VARCHAR(60) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "description" VARCHAR(500),
  "whatsapp" VARCHAR(24) NOT NULL,
  "telegram" VARCHAR(64),
  "province" VARCHAR(60),
  "municipality" VARCHAR(60),
  "street_address" VARCHAR(220),
  "hours" JSONB,
  "theme" JSONB,
  "base_currency" "CurrencyCode" NOT NULL DEFAULT 'CUP',
  "accepted_currencies" "CurrencyCode"[] DEFAULT ARRAY['CUP']::"CurrencyCode"[],
  "exchange_rates" JSONB NOT NULL,
  "rates_updated_at" TIMESTAMPTZ(6),
  "free_shipping_min" DECIMAL(12,2),
  "pickup_enabled" BOOLEAN NOT NULL DEFAULT false,
  "plan" "StorePlan" NOT NULL DEFAULT 'free',
  "plan_expires_at" TIMESTAMPTZ(6),
  "status" "StoreStatus" NOT NULL DEFAULT 'active',
  "suspended_reason" VARCHAR(240),
  "order_seq" INTEGER NOT NULL DEFAULT 0,
  "cache_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE INDEX "stores_owner_id_idx" ON "stores"("owner_id");
CREATE INDEX "stores_status_plan_idx" ON "stores"("status", "plan");

CREATE TABLE "categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "schedule" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "categories_store_id_sort_order_idx" ON "categories"("store_id", "sort_order");

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "category_id" UUID,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1200),
  "price" DECIMAL(12,2) NOT NULL,
  "compare_at_price" DECIMAL(12,2),
  "currency" "CurrencyCode" NOT NULL DEFAULT 'CUP',
  "stock" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sold_out" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "images" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "products_store_id_active_sort_order_idx" ON "products"("store_id", "active", "sort_order");
CREATE INDEX "products_store_id_category_id_idx" ON "products"("store_id", "category_id");

CREATE TABLE "product_variants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "sku" VARCHAR(64),
  "attributes" JSONB NOT NULL,
  "price_override" DECIMAL(12,2),
  "stock" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "product_variants_product_id_active_idx" ON "product_variants"("product_id", "active");

CREATE TABLE "shipping_zones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "province" VARCHAR(60) NOT NULL,
  "municipality" VARCHAR(60),
  "cost" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'CUP',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_zones_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "shipping_zones_store_id_province_municipality_idx" ON "shipping_zones"("store_id", "province", "municipality");

CREATE TABLE "payment_methods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "type" "PaymentMethodType" NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "currencies" "CurrencyCode"[],
  "instructions" VARCHAR(400),
  "account_data" VARCHAR(160),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_methods_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "payment_methods_store_id_enabled_sort_order_idx" ON "payment_methods"("store_id", "enabled", "sort_order");

CREATE TABLE "store_payment_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "provider" "PaymentProviderType" NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "sandbox" BOOLEAN NOT NULL DEFAULT true,
  "hint_last4" VARCHAR(8),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "store_payment_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_payment_credentials_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "store_payment_credentials_store_id_provider_key" ON "store_payment_credentials"("store_id", "provider");

CREATE TABLE "orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "order_number" INTEGER NOT NULL,
  "tracking_token" VARCHAR(64) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'created',
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "channel" "OrderChannel" NOT NULL DEFAULT 'whatsapp',
  "payment_method_id" UUID,
  "payment_label" VARCHAR(80) NOT NULL,
  "fulfillment_type" VARCHAR(20) NOT NULL,
  "shipping_zone_name" VARCHAR(120),
  "customer_snapshot" JSONB NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "cash_tendered" DECIMAL(12,2),
  "cash_change" DECIMAL(12,2),
  "coupon_code" VARCHAR(40),
  "receipt_object_key" VARCHAR(255),
  "cancel_reason" VARCHAR(240),
  "idempotency_key" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orders_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "orders_tracking_token_key" ON "orders"("tracking_token");
CREATE UNIQUE INDEX "orders_store_id_order_number_key" ON "orders"("store_id", "order_number");
CREATE UNIQUE INDEX "orders_store_id_idempotency_key_key" ON "orders"("store_id", "idempotency_key");
CREATE INDEX "orders_store_id_created_at_idx" ON "orders"("store_id", "created_at" DESC);
CREATE INDEX "orders_store_id_status_idx" ON "orders"("store_id", "status");

CREATE TABLE "order_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "product_id" UUID,
  "variant_id" UUID,
  "product_name" VARCHAR(120) NOT NULL,
  "variant_label" VARCHAR(100),
  "unit_price" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

CREATE TABLE "order_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "note" VARCHAR(240),
  "changed_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

CREATE TABLE "payment_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "provider" "PaymentProviderType" NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "idempotency_key" VARCHAR(96) NOT NULL,
  "external_transaction_id" VARCHAR(128),
  "confirm_url" VARCHAR(500),
  "provider_status_code" VARCHAR(40),
  "failure_reason" VARCHAR(240),
  "reconcile_attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");
CREATE INDEX "payment_transactions_store_id_status_idx" ON "payment_transactions"("store_id", "status");
CREATE INDEX "payment_transactions_provider_external_transaction_id_idx" ON "payment_transactions"("provider", "external_transaction_id");
CREATE INDEX "payment_transactions_status_updated_at_idx" ON "payment_transactions"("status", "updated_at");

CREATE TABLE "plans_config" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(32) NOT NULL,
  "free_limits" JSONB NOT NULL,
  "pro_limits" JSONB NOT NULL,
  "pro_price_cup" DECIMAL(12,2) NOT NULL,
  "pro_price_usd" DECIMAL(12,2) NOT NULL,
  "pro_duration_days" INTEGER NOT NULL,
  "payment_instructions" VARCHAR(600) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "plans_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_config_key_key" ON "plans_config"("key");

CREATE TABLE "subscription_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "target_plan" "StorePlan" NOT NULL DEFAULT 'pro',
  "duration_days" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "payment_method_label" VARCHAR(60) NOT NULL,
  "reference" VARCHAR(80) NOT NULL,
  "receipt_object_key" VARCHAR(255) NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
  "rejection_reason" VARCHAR(240),
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscription_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subscription_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "subscription_requests_status_created_at_idx" ON "subscription_requests"("status", "created_at");
CREATE INDEX "subscription_requests_store_id_idx" ON "subscription_requests"("store_id");

CREATE TABLE "coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "discount_type" "DiscountType" NOT NULL,
  "discount_value" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'CUP',
  "min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "max_uses" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "coupons_store_id_code_key" ON "coupons"("store_id", "code");
CREATE INDEX "coupons_store_id_active_idx" ON "coupons"("store_id", "active");

CREATE TABLE "promotions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "category_id" UUID,
  "name" VARCHAR(100) NOT NULL,
  "type" "PromotionType" NOT NULL,
  "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "min_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "product_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promotions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "promotions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "promotions_store_id_active_idx" ON "promotions"("store_id", "active");

CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "product_id" UUID,
  "target_type" "ReportTargetType" NOT NULL,
  "reason" VARCHAR(80) NOT NULL,
  "details" VARCHAR(500) NOT NULL,
  "reporter_contact" VARCHAR(120),
  "status" "ReportStatus" NOT NULL DEFAULT 'open',
  "resolution_note" VARCHAR(300),
  "reviewed_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");
CREATE INDEX "reports_store_id_idx" ON "reports"("store_id");

CREATE TABLE "analytics_daily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "store_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "visits" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "analytics_daily_store_id_day_key" ON "analytics_daily"("store_id", "day");

CREATE TABLE "audit_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "actor_role" VARCHAR(24) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "entity_type" VARCHAR(48) NOT NULL,
  "entity_id" VARCHAR(64) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS): Denegar TODO acceso desde la API REST de Supabase
-- NestJS accede usando la cadena de conexión del servidor.
-- ============================================================================
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_payment_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
