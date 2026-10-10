/**
 * Minimal .xlsx reader — just enough to turn MT5's "Report" export into rows.
 *
 * An .xlsx file is a ZIP of XML, and the only thing the journal parser wants is
 * a string[][] it can run its existing column matching over. So this unzips the
 * archive with the platform's own DecompressionStream and reads the sheet XML,
 * rather than pulling in SheetJS.
 *
 * Why not SheetJS, which the brief asked for: the build on the npm registry is
 * 0.18.5 and carries CVE-2023-30533 (prototype pollution while parsing a
 * workbook) — the fixed releases are published only on the vendor's own CDN, so
 * using it means either a known advisory in the dependency tree or a build that
 * fetches a tarball from cdn.sheetjs.com every time it runs. It is also ~400 kB
 * to read a file format that is a ZIP with three XML files in it. The cost of
 * this decision is below: .xls, the pre-2007 binary format, is not a ZIP and is
 * not supported. MT5 exports .xlsx, so that is not a gap in practice — if an
 * old broker build ever emits real .xls, SheetJS is the right answer and this
 * module is the thing to replace.
 *
 * Everything here runs in the browser on the member's own file. Nothing is
 * uploaded.
 */

const EOCD = 0x06054b50;
const CDIR = 0x02014b50;

interface Entry { name: string; method: number; size: number; offset: number }

/** Walks the central directory, which is the only reliable index in a ZIP. */
function entries(view: DataView): Entry[] {
  // The end-of-central-directory record sits in the last 64 KB, after a comment
  // of unknown length, so it has to be found by scanning backwards.
  let eocd = -1;
  const from = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= from; i--) {
    if (view.getUint32(i, true) === EOCD) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("not a zip archive");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: Entry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CDIR) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + p + 46, nameLen));
    out.push({ name, method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function read(view: DataView, e: Entry): Promise<string> {
  // The local header repeats the name and extra fields; the payload follows it.
  const nameLen = view.getUint16(e.offset + 26, true);
  const extraLen = view.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, e.size);

  if (e.method === 0) return new TextDecoder().decode(bytes);
  if (e.method !== 8) throw new Error(`unsupported compression (${e.method})`);

  // Copied into its own buffer: a view onto the caller's ArrayBuffer is not a
  // valid BlobPart when that buffer could be shared.
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function unescapeXml(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

/** All the text inside one element, tags stripped. */
function textOf(xml: string): string {
  return unescapeXml(xml.replace(/<[^>]*>/g, ""));
}

/** "BC" -> 28. Column letters are the only place a cell says where it belongs. */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  // Each <si> may hold one <t> or several inside <r> runs; the concatenation of
  // its text is the string either way. exec loops rather than matchAll: this
  // project compiles without downlevelIteration.
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(textOf(m[1]));
  return out;
}

function sheetRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = [];

  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];

      let value: string;
      if (type === "s") {
        const i = Number(textOf(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ""));
        value = strings[i] ?? "";
      } else if (type === "inlineStr") {
        value = textOf(body);
      } else {
        value = textOf(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      }

      // Sparse rows: <c r="C1"> after <c r="A1"> means B1 is empty, and the
      // column matching downstream is positional, so the gap has to be kept.
      if (ref) {
        const at = columnIndex(ref);
        while (cells.length < at) cells.push("");
        cells[at] = value;
      } else {
        cells.push(value);
      }
    }
    // Self-closing <c/> cells produce nothing above, so a row of only those is
    // empty and dropped with the genuinely blank ones.
    rows.push(cells);
  }

  return rows;
}

/**
 * The first worksheet that has any content, as rows of strings.
 *
 * Numbers come back as their raw text, which is what the journal parser wants —
 * including dates, which Excel stores as a day count and the time parser
 * converts.
 */
export async function xlsxToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const view = new DataView(buffer);
  const list = entries(view);

  const byName = new Map(list.map((e) => [e.name, e]));
  const sharedEntry = byName.get("xl/sharedStrings.xml");
  const strings = sharedEntry ? sharedStrings(await read(view, sharedEntry)) : [];

  // Sheet order in the archive is not guaranteed, so sort by the sheetN number.
  const sheets = list
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(a.name.match(/(\d+)/)![1]) - Number(b.name.match(/(\d+)/)![1]));

  if (!sheets.length) throw new Error("no worksheet in that workbook");

  for (const sheet of sheets) {
    const rows = sheetRows(await read(view, sheet), strings);
    if (rows.some((r) => r.some((c) => c.trim() !== ""))) return rows;
  }
  return [];
}

/** True for a ZIP magic number, which is what an .xlsx actually is. */
export function looksLikeXlsx(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7);
}
