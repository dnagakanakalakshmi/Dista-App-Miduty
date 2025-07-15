-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCSS" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "showAddToCart" BOOLEAN NOT NULL DEFAULT true,
    "showBuyNow" BOOLEAN NOT NULL DEFAULT true,
    "displayMode" TEXT NOT NULL DEFAULT 'carousel',
    "productsPerRow" INTEGER NOT NULL DEFAULT 3,
    "initialProducts" INTEGER NOT NULL DEFAULT 6,
    "cardLayout" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCSS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCSS_RO" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "showAddToCart" BOOLEAN NOT NULL DEFAULT true,
    "showReorder" BOOLEAN NOT NULL DEFAULT true,
    "displayMode" TEXT NOT NULL DEFAULT 'carousel',
    "productsPerRow" INTEGER NOT NULL DEFAULT 3,
    "initialProducts" INTEGER NOT NULL DEFAULT 6,
    "cardLayout" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCSS_RO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCredentials" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickViewCss" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "css" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickViewCss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widgetSettings" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "starsText" TEXT NOT NULL DEFAULT '{count} review/reviews',
    "saveText" TEXT NOT NULL DEFAULT 'Save {percent}%',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomCSS_shop_key" ON "CustomCSS"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCSS_RO_shop_key" ON "CustomCSS_RO"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "QuickViewCss_shop_key" ON "QuickViewCss"("shop");
