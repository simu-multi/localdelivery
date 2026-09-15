/*
# Create rider_documents table and storage bucket

## Purpose
Riders can upload identity documents (Aadhaar Card, PAN Card, Driving Licence)
as proof of identity. Documents are stored securely — only the owning rider
and authorized admins can view them. Document approval is NOT required;
riders can accept deliveries immediately after registration.

## 1. New Tables
- `rider_documents`
  - `id` (uuid, primary key)
  - `rider_id` (uuid, foreign key to profiles.id, defaults to auth.uid())
  - `doc_type` (text, one of: 'aadhaar', 'pan', 'driving_licence')
  - `file_path` (text, path to file in storage bucket)
  - `file_name` (text, original file name)
  - `mime_type` (text, e.g. 'image/jpeg', 'application/pdf')
  - `created_at` (timestamptz, defaults to now())

## 2. Storage
- Creates a private storage bucket `rider-documents` for storing uploaded files.
- Files are stored under a path: `<rider_id>/<doc_type>/<filename>`

## 3. Security (RLS)
- Enable RLS on `rider_documents`.
- Riders can SELECT, INSERT, UPDATE, DELETE only their own documents.
- Admins can SELECT all rider documents (for verification/record purposes).
- Storage policies: riders can upload/read/delete only into their own folder.
- Admins can read any file in the rider-documents bucket.

## 4. Important Notes
1. The `rider_id` column defaults to `auth.uid()` so inserts from the client
   that omit it still satisfy the INSERT policy's WITH CHECK.
2. The storage bucket is private — files are served via signed URLs only.
3. No admin approval step exists — documents are for record purposes only.
*/

-- ── Create rider_documents table ──
CREATE TABLE IF NOT EXISTS rider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('aadhaar', 'pan', 'driving_licence')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rider_documents ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: riders can manage their own documents ──
DROP POLICY IF EXISTS "rider_docs_select_own" ON rider_documents;
CREATE POLICY "rider_docs_select_own" ON rider_documents FOR SELECT
  TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "rider_docs_select_admin" ON rider_documents;
CREATE POLICY "rider_docs_select_admin" ON rider_documents FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "rider_docs_insert_own" ON rider_documents;
CREATE POLICY "rider_docs_insert_own" ON rider_documents FOR INSERT
  TO authenticated WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "rider_docs_update_own" ON rider_documents;
CREATE POLICY "rider_docs_update_own" ON rider_documents FOR UPDATE
  TO authenticated USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "rider_docs_delete_own" ON rider_documents;
CREATE POLICY "rider_docs_delete_own" ON rider_documents FOR DELETE
  TO authenticated USING (rider_id = auth.uid());

-- ── Create private storage bucket ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('rider-documents', 'rider-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS: riders can upload/read/delete into their own folder ──
DROP POLICY IF EXISTS "rider_docs_storage_read_own" ON storage.objects;
CREATE POLICY "rider_docs_storage_read_own" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "rider_docs_storage_read_admin" ON storage.objects;
CREATE POLICY "rider_docs_storage_read_admin" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "rider_docs_storage_insert_own" ON storage.objects;
CREATE POLICY "rider_docs_storage_insert_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "rider_docs_storage_update_own" ON storage.objects;
CREATE POLICY "rider_docs_storage_update_own" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "rider_docs_storage_delete_own" ON storage.objects;
CREATE POLICY "rider_docs_storage_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
