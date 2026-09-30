-- Bills rung up while the till had no connection and uploaded later.
ALTER TABLE "pos_counter_sales" ADD COLUMN "soldOffline" BOOLEAN NOT NULL DEFAULT false;
