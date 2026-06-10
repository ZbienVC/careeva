-- Binary file storage shared between the web app and the apply worker.
-- Replaces the Railway-volume file layout (volumes are single-service).
CREATE TABLE "file_blobs" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("key")
);
