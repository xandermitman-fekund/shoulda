-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Interest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "negotiationId" TEXT NOT NULL,
    "ownerPartyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "maslowTier" TEXT,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interest_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "Negotiation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interest_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Interest" ("changed", "createdAt", "id", "maslowTier", "negotiationId", "ownerPartyId", "text") SELECT "changed", "createdAt", "id", "maslowTier", "negotiationId", "ownerPartyId", "text" FROM "Interest";
DROP TABLE "Interest";
ALTER TABLE "new_Interest" RENAME TO "Interest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
