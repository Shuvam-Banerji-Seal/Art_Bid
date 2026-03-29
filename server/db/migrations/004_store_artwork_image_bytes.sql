-- Persist uploaded image bytes in PostgreSQL so image data survives web service restarts.
ALTER TABLE artwork_images
  ADD COLUMN IF NOT EXISTS image_data BYTEA,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
