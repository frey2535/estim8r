import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatHeldOutCorpusStatus,
  summarizeHeldOutCorpus,
} from "./heldOutCorpus.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "fixtures/held-out-corpus.manifest.json"), "utf8"));
const summary = summarizeHeldOutCorpus(manifest);

console.log(formatHeldOutCorpusStatus(summary));

assert(summary.ready === false, "empty held-out corpus must block readiness");
assert(summary.canClaimProduction99 === false, "production 99% claims must remain blocked without held-out corpus");
assert(summary.projects === 0, "manifest must not pretend existing regressions are held-out projects");
assert(summary.candidateSources >= 3, "public candidate sources are tracked separately from held-out projects");
assert(summary.blockers.some((item) => /held-out projects/.test(item)), "missing held-out projects blocker is reported");
assert(summary.blockers.some((item) => /different firms/.test(item)), "missing multi-firm blocker is reported");
assert(summary.blockers.some((item) => /vector PDFs/.test(item)), "missing vector blocker is reported");
assert(summary.blockers.some((item) => /raster\/scanned/.test(item)), "missing raster/scanned blocker is reported");

const ready = summarizeHeldOutCorpus({
  version: 1,
  projects: [
    {
      id: "heldout-vector-a",
      partition: "held-out",
      firmId: "firm-a",
      labelAuthority: "independent",
      bodyLabeled: true,
      drawingModes: ["vector"],
      sheetCount: 8,
      deviceCount: 120,
      deviceTypes: ["R", "GFI", "OS"],
      source: { drawingFile: "corpus/firm-a/vector.pdf", labelFile: "corpus/firm-a/vector.labels.json" },
    },
    {
      id: "heldout-scanned-b",
      partition: "held-out",
      firmId: "firm-b",
      labelAuthority: "independent",
      bodyLabeled: true,
      drawingModes: ["scanned"],
      sheetCount: 6,
      deviceCount: 90,
      deviceTypes: ["1", "2", "OS"],
      source: { drawingFile: "corpus/firm-b/scanned.pdf", labelFile: "corpus/firm-b/scanned.labels.json" },
    },
    {
      id: "heldout-vector-c",
      partition: "held-out",
      firmId: "firm-c",
      labelAuthority: "independent",
      bodyLabeled: true,
      drawingModes: ["cad-vector"],
      sheetCount: 7,
      deviceCount: 105,
      deviceTypes: ["WP", "SP", "EF"],
      source: { drawingFile: "corpus/firm-c/vector.pdf", labelFile: "corpus/firm-c/vector.labels.json" },
    },
  ],
});

assert(ready.ready === true, "validator accepts real independent multi-firm vector plus scanned held-out coverage");
assert(ready.canClaimProduction99 === true, "ready corpus permits benchmark claims if measured metrics also pass");

if (!process.exitCode) console.log("held-out corpus checks passed");
