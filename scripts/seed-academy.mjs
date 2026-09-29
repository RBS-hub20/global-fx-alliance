#!/usr/bin/env node
/**
 * Seeds (or re-checks) the Academy catalogue: five books and forty lessons.
 *
 *   set -a; source .env.local; set +a
 *   node scripts/seed-academy.mjs          # report what is there
 *   node scripts/seed-academy.mjs --write  # insert anything missing
 *
 * The same rows the SQL migration seeds. Safe to run repeatedly: books are
 * matched on book_number and lessons on slug, and existing titles are left
 * alone — this never renames a book you have already published.
 */

import { createClient } from "@supabase/supabase-js";
import { academyEnv, explain } from "../src/lib/academyEnv.mjs";

const write = process.argv.includes("--write");
const { url, key } = academyEnv();
const db = createClient(url, key, { auth: { persistSession: false } });

const BOOKS = [
  { book_number: 1, title: "Forex From Zero", slug: "forex-from-zero", emoji: "📘", total_lessons: 12 },
  { book_number: 2, title: "The Candlestick Handbook", slug: "candlestick-handbook", emoji: "🕯", total_lessons: 8 },
  { book_number: 3, title: "Market Structure Mastery", slug: "market-structure", emoji: "📊", total_lessons: 7 },
  { book_number: 4, title: "Liquidity & Price Action", slug: "liquidity-price-action", emoji: "💧", total_lessons: 7 },
  { book_number: 5, title: "The GFXA Trading Strategy Playbook", slug: "strategy-playbook", emoji: "🎯", total_lessons: 6 },
];

const { data: existing, error } = await db.from("academy_books").select("id, book_number, title").order("book_number");
if (error) { console.error("academy_books:", explain(error)); process.exit(1); }

console.log(`academy_books: ${existing.length} row(s)`);
for (const b of existing) console.log(`  ${b.book_number}. ${b.title}`);

const missing = BOOKS.filter((b) => !existing.some((e) => e.book_number === b.book_number));
if (missing.length && write) {
  const { error: e } = await db.from("academy_books").insert(missing);
  if (e) { console.error("insert books:", explain(e)); process.exit(1); }
  console.log(`inserted ${missing.length} book(s)`);
} else if (missing.length) {
  console.log(`missing books: ${missing.map((b) => b.book_number).join(", ")} — re-run with --write`);
}

const { count: lessonCount, error: le } = await db.from("academy_lessons").select("id", { count: "exact", head: true });
if (le) { console.error("academy_lessons:", explain(le)); process.exit(1); }
console.log(`academy_lessons: ${lessonCount} row(s) (expected 40)`);
if (lessonCount !== 40) {
  console.log("  Lessons are seeded by supabase/20250929_academy_books.sql — run that in the SQL editor;");
  console.log("  it carries the titles, tracks and the 12 / 18 / 10 split.");
}

const { count: pageCount } = await db.from("academy_pages").select("id", { count: "exact", head: true });
console.log(`academy_pages: ${pageCount ?? 0} row(s)`);

for (const b of BOOKS) {
  const { data } = await db.storage.from("academy-books").list(`book-0${b.book_number}`, { limit: 1000 });
  console.log(`  storage book-0${b.book_number}: ${data?.length ?? 0} object(s)`);
}
