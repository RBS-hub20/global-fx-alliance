#!/usr/bin/env node
/**
 * Uploads a book's page images into the private academy-books bucket and
 * registers them against its lessons.
 *
 *   node scripts/import-academy-pages.mjs --book 1 --dir ~/books/book-01
 *
 * The directory holds one image per page, named so they sort in reading order
 * (page-001.webp, page-002.webp …). Pages are split evenly across that book's
 * lessons unless --pages-per-lesson is given.
 *
 * Needs, in the environment:
 *   NEXT_PUBLIC_SUPABASE_URL   SUPABASE_SERVICE_ROLE_KEY
 * The service key is used because the bucket and academy_pages are closed to
 * everyone else — that is the point of them.
 *
 * Re-running is safe: the object path and the (lesson, page) row are both
 * upserted, so a corrected page replaces the old one instead of duplicating it.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);

const bookNumber = Number(args.book);
const dir = args.dir;
if (!bookNumber || !dir) {
  console.error("usage: --book <1-5> --dir <folder of page images> [--pages-per-lesson N]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const files = (await readdir(dir))
  .filter((f) => TYPES[extname(f).toLowerCase()])
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) {
  console.error(`No .webp/.png/.jpg files in ${dir}`);
  process.exit(1);
}

const { data: book } = await db.from("academy_books").select("id, title").eq("book_number", bookNumber).maybeSingle();
if (!book) { console.error(`Book ${bookNumber} is not seeded — run the migration first.`); process.exit(1); }

const { data: lessons } = await db
  .from("academy_lessons").select("id, book_lesson, title")
  .eq("book_id", book.id).order("book_lesson");

if (!lessons?.length) { console.error("That book has no lessons."); process.exit(1); }

const per = Number(args["pages-per-lesson"]) || Math.ceil(files.length / lessons.length);
console.log(`${book.title}: ${files.length} pages over ${lessons.length} lessons (~${per} each)`);

let uploaded = 0;
for (const [i, file] of files.entries()) {
  const lesson = lessons[Math.min(Math.floor(i / per), lessons.length - 1)];
  const pageInLesson = (i % per) + 1;
  const ext = extname(file).toLowerCase();
  const objectPath = `book-${String(bookNumber).padStart(2, "0")}/${basename(file)}`;

  const body = await readFile(join(dir, file));
  const up = await db.storage.from("academy-books").upload(objectPath, body, {
    contentType: TYPES[ext], upsert: true,
  });
  if (up.error) { console.error(`  ${file}: ${up.error.message}`); continue; }

  const row = await db.from("academy_pages").upsert(
    { lesson_id: lesson.id, page_number: pageInLesson, content_type: "image", object_path: objectPath },
    { onConflict: "lesson_id,page_number" }
  );
  if (row.error) { console.error(`  ${file}: ${row.error.message}`); continue; }

  uploaded++;
  process.stdout.write(`\r  uploaded ${uploaded}/${files.length}`);
}

const { count } = await db.from("academy_pages").select("id", { count: "exact", head: true });
await db.from("academy_books").update({ total_pages: files.length }).eq("id", book.id);
console.log(`\nDone. ${uploaded} pages stored; ${count} pages in the library.`);
