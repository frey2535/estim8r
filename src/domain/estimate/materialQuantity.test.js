import assert from "node:assert/strict";
import { materialQuantity } from "./materialQuantity.js";
assert.equal(materialQuantity({ quantity: 120 }), 120);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: 1000 }), 1000);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: 0 }), 0);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: null }), 120);
