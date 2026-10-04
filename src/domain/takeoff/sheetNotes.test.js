import { extractSheetNotes, isNoteMark, mergeExtractedNotes, notesToMarks } from "./sheetNotes.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const pages = [
  {
    page: 6,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "NOTES", x: 8, y: 12 },
      { text: "1.", x: 8, y: 16 },
      { text: "PROVIDE", x: 11, y: 16 },
      { text: "GFCI", x: 20, y: 16 },
      { text: "WHERE", x: 26, y: 16 },
      { text: "SHOWN", x: 34, y: 16 },
      { text: "2.", x: 8, y: 20 },
      { text: "MOUNT", x: 11, y: 20 },
      { text: "DEVICES", x: 18, y: 20 },
      { text: "AFF", x: 28, y: 20 },
      { text: "GFI", x: 40, y: 40 },
    ],
  },
  {
    page: 2,
    kind: "legend",
    tokens: [
      { text: "PLUMBING GENERAL NOTES AND LEGENDS", x: 78, y: 88 },
      { text: "P0.01", x: 91, y: 93 },
      { text: "NOTES", x: 8, y: 12 },
      { text: "1.", x: 8, y: 16 },
      { text: "CONNECT", x: 11, y: 16 },
      { text: "WATER", x: 20, y: 16 },
      { text: "HEATER", x: 28, y: 16 },
    ],
  },
];

const notes = extractSheetNotes(pages, "electrical");
assert(notes.length === 2, `electrical plan notes extracted, got ${notes.length}`);
assert(notes.every((note) => note.sheet === 6), "notes stay on the electrical sheet");
assert(notes.some((note) => /GFCI/i.test(note.text)), "note 1 keeps the printed sentence");
assert(!notes.some((note) => /WATER HEATER/i.test(note.text)), "plumbing notes are not pulled onto electrical takeoff");

const marks = notesToMarks(notes, "electrical");
assert(marks.every(isNoteMark), "extracted notes become note marks");
assert(marks.every((mark) => mark.type === "note"), "notes are not device counts");
assert(mergeExtractedNotes(marks, pages, "electrical").length === marks.length, "existing AI notes are not duplicated");
assert(mergeExtractedNotes([], pages, "electrical").length === 2, "notes can be merged onto a saved takeoff");

const e001 = {
  page: 48,
  kind: "legend",
  sheetId: "E001",
  title: "E001 GENERAL NOTES & LEGENDS",
  tokens: [
    { text: "E001", x: 90, y: 92 },
    { text: "GENERAL", x: 20, y: 8 },
    { text: "NOTES", x: 30, y: 8 },
    { text: "1.", x: 20, y: 16 },
    { text: "PROVIDE", x: 24, y: 16 },
    { text: "DEVICES", x: 34, y: 16 },
    { text: "AS", x: 42, y: 16 },
    { text: "SHOWN", x: 46, y: 16 },
  ],
};
const es100 = {
  page: 55,
  kind: "drawing",
  sheetId: "ES100",
  title: "ES100 SITE PLAN",
  tokens: [
    { text: "ES100", x: 90, y: 92 },
    { text: "SITE", x: 80, y: 90 },
    { text: "PLAN", x: 86, y: 90 },
    { text: "KEYNOTES", x: 30, y: 20 },
    { text: "1.", x: 30, y: 24 },
    { text: "PROVIDE", x: 34, y: 24 },
    { text: "GROUNDING", x: 44, y: 24 },
    { text: "FOR", x: 56, y: 24 },
    { text: "ALL", x: 60, y: 24 },
    { text: "EQUIPMENT", x: 64, y: 24 },
  ],
};
assert(extractSheetNotes([e001], "electrical").length === 0, "E001 legend keynotes are not takeoff notes");
assert(extractSheetNotes([es100], "electrical").length === 0, "ES100 site keynotes are not takeoff notes");

if (!process.exitCode) console.log("sheet note checks passed");
