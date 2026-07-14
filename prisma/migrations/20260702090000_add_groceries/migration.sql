-- CreateEnum
CREATE TYPE "GroceryCategory" AS ENUM ('veggies', 'meat', 'fish', 'sauce', 'cooked_food');

-- CreateTable
CREATE TABLE "groceries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GroceryCategory" NOT NULL,
    "dateAdded" TIMESTAMP(3) NOT NULL,
    "openedDate" TIMESTAMP(3),
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groceries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groceries_finished_idx" ON "groceries"("finished");

-- CreateIndex
CREATE INDEX "groceries_createdAt_idx" ON "groceries"("createdAt");
