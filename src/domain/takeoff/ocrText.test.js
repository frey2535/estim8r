import assert from "node:assert/strict";
import { recognizeImage } from "./ocrText.js";

const result = await recognizeImage("page-image", async () => ({
  recognize: async () => ({ data: { text: " PANEL A \n GFCI ", words: [{ text: "PANEL" }, { text: "GFCI" }] } }),
  terminate: async () => {},
}));
assert.equal(result.ok, true);
assert.equal(result.text, "PANEL A GFCI");
assert.equal(result.words.length, 2);
assert.equal((await recognizeImage(null, async () => ({}))).ok, false);
console.log("ocr text checks passed");
