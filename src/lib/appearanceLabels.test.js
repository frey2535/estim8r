import assert from "node:assert/strict";
import { APPEARANCE_GROUPS, COLOR_TOKENS, appearanceColor, hslComponentsToHex } from "./appearanceLabels.js";

const listed = APPEARANCE_GROUPS.flatMap((group) => group.colors.map((item) => item.token));
assert.deepEqual([...listed].sort(), [...COLOR_TOKENS].sort(), "every color setting is listed once");
assert.equal(new Set(listed).size, listed.length, "color settings are not repeated");

const labels = [];
for (const token of COLOR_TOKENS) {
  const copy = appearanceColor(token);
  assert.ok(copy, `${token} has a label`);
  assert.notEqual(copy.label, token, `${token} is not shown as its code name`);
  assert.equal(copy.label.includes("-"), false, `${token} label is plain words`);
  assert.ok(copy.detail.length > 24, `${token} explains where the color is used`);
  labels.push(copy.label);
}
assert.equal(new Set(labels).size, labels.length, "color labels are unique");

assert.equal(hslComponentsToHex("0 0% 100%"), "#ffffff");
assert.equal(hslComponentsToHex("0 0% 0%"), "#000000");
assert.equal(hslComponentsToHex("not a color"), null);

console.log("appearance label checks passed");
