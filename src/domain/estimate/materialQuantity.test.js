import assert from "node:assert/strict";
import { materialQuantity, materialQuoteQuantity } from "./materialQuantity.js";
assert.equal(materialQuantity({ quantity: 120 }), 120);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: 1000 }), 1000);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: 0 }), 0);
assert.equal(materialQuantity({ quantity: 120, materialQuantity: null }), 120);

assert.equal(materialQuantity({ quantity: 120, purchasePackage: { unit: "REEL", size: 1000 } }), 1000);
assert.equal(materialQuoteQuantity({ quantity: 120, purchasePackage: { unit: "REEL", size: 1000 } }), 1);
assert.equal(materialQuantity({ quantity: 125, purchasePackage: { unit: "STICK", size: 10 } }), 130);
assert.equal(materialQuoteQuantity({ quantity: 35, purchasePackage: { unit: "BOX", size: 50 } }), 1);
assert.equal(materialQuantity({ quantity: 120, purchasePackage: { unit: "REEL", size: 0 } }), 120);
