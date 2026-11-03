-- CreateTable
CREATE TABLE "request_metrics" (
    "id" SERIAL NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "route" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "count" INTEGER NOT NULL,
    "total_ms" BIGINT NOT NULL,
    "max_ms" INTEGER NOT NULL,
    "last_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_metrics_hour_kind_method_route_code_key" ON "request_metrics"("hour", "kind", "method", "route", "code");

