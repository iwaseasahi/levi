BEGIN;
-- Synthetic only. Loaded exclusively into the disposable backup rehearsal DB.
INSERT INTO churches (id, name) VALUES
 ('00000000-0000-4000-8000-000000389001', 'test.restore.deleted-church'),
 ('00000000-0000-4000-8000-000000389002', 'test.restore.preserved-church');
INSERT INTO slides (id, church_id, title, body, revision) VALUES
 ('00000000-0000-4000-8000-000000389011', '00000000-0000-4000-8000-000000389001', 'Synthetic cascade', 'Synthetic body', 1),
 ('00000000-0000-4000-8000-000000389012', '00000000-0000-4000-8000-000000389002', 'Synthetic deleted slide', 'Synthetic body', 2),
 ('00000000-0000-4000-8000-000000389013', '00000000-0000-4000-8000-000000389002', 'Synthetic preserved slide', E'日本語\n\n\n\nSecond', 3);
INSERT INTO bible_books (id, canonical_code, canonical_order, testament)
 VALUES ('00000000-0000-4000-8000-000000389020', 'TBR389', 90, 'NEW');
INSERT INTO bible_verses (book_id, translation_id, chapter_number, verse_number, text)
 SELECT '00000000-0000-4000-8000-000000389020', id, 1, 1, 'Synthetic recovery verse'
 FROM bible_translations WHERE code = 'JSS3';
INSERT INTO folders (id, church_id, name, position) VALUES
 ('00000000-0000-4000-8000-000000389030', '00000000-0000-4000-8000-000000389002', 'Synthetic preserved folder', 0);
INSERT INTO bookmarks (id, church_id, folder_id, title, position) VALUES
 ('00000000-0000-4000-8000-000000389031', '00000000-0000-4000-8000-000000389002', '00000000-0000-4000-8000-000000389030', 'Synthetic preserved bookmark', 0);
INSERT INTO scripture_bookmarks (bookmark_id, book_id, primary_translation_id, chapter_number, start_verse)
 SELECT '00000000-0000-4000-8000-000000389031', '00000000-0000-4000-8000-000000389020', id, 1, 1
 FROM bible_translations WHERE code = 'JSS3';
INSERT INTO admin_users (id, name, email, status, activated_at) VALUES
 ('00000000-0000-4000-8000-000000389040', 'Synthetic recovery admin', 'test.restore.admin@example.invalid', 'ACTIVE', now());
INSERT INTO admin_sessions (user_id, token, expires_at) VALUES
 ('00000000-0000-4000-8000-000000389040', 'synthetic-restore-admin-session', now() + interval '30 days');
COMMIT;
