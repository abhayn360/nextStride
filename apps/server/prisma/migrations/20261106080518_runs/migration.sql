-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "distance_meters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "moving_time_seconds" INTEGER NOT NULL DEFAULT 0,
    "average_pace_seconds_per_km" DOUBLE PRECISION,
    "average_speed" DOUBLE PRECISION,
    "calories_estimate" INTEGER,
    "point_count" INTEGER NOT NULL DEFAULT 0,
    "route_preview" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_points" (
    "id" BIGSERIAL NOT NULL,
    "run_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "segment" INTEGER NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_user_id_status_started_at_idx" ON "runs"("user_id", "status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "runs_user_id_status_distance_meters_idx" ON "runs"("user_id", "status", "distance_meters" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "runs_user_id_client_id_key" ON "runs"("user_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_points_run_id_recorded_at_key" ON "run_points"("run_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_points" ADD CONSTRAINT "run_points_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
