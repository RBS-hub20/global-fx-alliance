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
import { academyEnv, explain } from "../src/lib/academyEnv.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);

const bookNumber = Number(args.book);
const dir = args.dir;
if (!bookNumber || !dir) {
  console.error("usage: --book <1-5> --dir <folder of page images> [--pages-per-lesson N]");
  process.exit(1);
}

let env;
try { env = academyEnv(); } catch (e) { console.error(e.message); process.exit(1); }
const db = createClient(env.url, env.key, { auth: { persistSession: false } });
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const files = (await readdir(dir))
  .filter((f) => TYPES[extname(f).toLowerCase()])
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) {
  console.error(`No .webp/.png/.jpg files in ${dir}`);
  process.exit(1);
}

const { data: book, error: bookErr } = await db
  .from("academy_books").select("id, title").eq("book_number", bookNumber).maybeSingle();

// An unusable key and an unseeded table look identical from here unless the
// error is printed — that is what made this say "not seeded" when the real
// problem was the redacted service key.
if (bookErr) { console.error(`Could not read academy_books: ${explain(bookErr)}`); process.exit(1); }
if (!book) {
  console.error(`Book ${bookNumber} has no row in academy_books.`);
  console.error("  Run supabase/20250929_academy_books.sql, or: node scripts/seed-academy.mjs --write");
  process.exit(1);
}

const { data: lessons, error: lessonErr } = await db
  .from("academy_lessons").select("id, book_lesson, title")
  .eq("book_id", book.id).order("book_lesson");

if (lessonErr) { console.error(`Could not read academy_lessons: ${explain(lessonErr)}`); process.exit(1); }
if (!lessons?.length) { console.error("That book has no lessons — run the migration."); process.exit(1); }

/*
 * Spread the remainder instead of rounding up.
 *
 * Math.ceil left the last lesson empty whenever the pages divided unevenly:
 * 88 pages over 12 lessons rounded to 8 each, and 11 lessons took all 88. Now
 * the first (pages % lessons) lessons take one extra, so every lesson gets
 * pages and the totals still add up.
 */
const fixed = Number(args["pages-per-lesson"]) || 0;
const base = Math.floor(files.length / lessons.length);
const extra = files.length % lessons.length;
const sizes = lessons.map((_, i) => (fixed ? fixed : base + (i < extra ? 1 : 0)));

console.log(`${book.title}: ${files.length} pages over ${lessons.length} lessons`);
console.log(`  split: ${sizes.join(", ")}`);

// file index -> { lesson, page within that lesson }
const plan = [];
let cursor = 0;
lessons.forEach((lesson, li) => {
  for (let n = 1; n <= sizes[li] && cursor < files.length; n++) plan[cursor++] = { lesson, pageInLesson: n };
});
// Anything left over (only possible with --pages-per-lesson) joins the last lesson.
let tailPage = (sizes[sizes.length - 1] ?? 0) + 1;
while (cursor < files.length) plan[cursor++] = { lesson: lessons[lessons.length - 1], pageInLesson: tailPage++ };

let uploaded = 0;
for (const [i, file] of files.entries()) {
  const { lesson, pageInLesson } = plan[i];
  const ext = extname(file).toLowerCase();
  const objectPath = `book-${String(bookNumber).padStart(2, "0")}/${basename(file)}`;

  const body = await readFile(join(dir, file));
  const up = await db.storage.from("academy-books").upload(objectPath, body, {
    contentType: TYPES[ext], upsert: true,
  });
  if (up.error) { console.error(`\n  ${file}: ${explain(up.error)}`); continue; }

  const row = await db.from("academy_pages").upsert(
    { lesson_id: lesson.id, page_number: pageInLesson, content_type: "image", object_path: objectPath },
    { onConflict: "lesson_id,page_number" }
  );
  if (row.error) { console.error(`\n  ${file}: ${explain(row.error)}`); continue; }

  uploaded++;
  process.stdout.write(`\r  uploaded ${uploaded}/${files.length}`);
}

await db.from("academy_books").update({ total_pages: files.length }).eq("id", book.id);

const { count } = await db.from("academy_pages").select("id", { count: "exact", head: true });
const { data: check } = await db.storage.from("academy-books").list(`book-${String(bookNumber).padStart(2, "0")}`, { limit: 1000 });

console.log(`\nBook ${bookNumber}: ${uploaded}/${files.length} pages stored`);
console.log(`  storage objects: ${check?.length ?? 0}`);
console.log(`  academy_pages rows (all books): ${count ?? 0}`);
if (uploaded !== files.length) console.log("  Some pages failed — the errors above say which.");
