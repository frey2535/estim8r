import assert from "node:assert/strict";
import {
  isStaticHostCatalogRejection,
  shouldUseLiveCatalogDevProxy,
} from "./liveSupplierCatalogHost.js";

const nginx405 = `<html> <head><title>405 Not Allowed</title></head> <body bgcolor="white"> <center><h1>405 Not Allowed</h1></center> </body> </html>`;

assert.equal(shouldUseLiveCatalogDevProxy({ isDev: true, hostname: "estim8r.currentflowconsulting.org" }), true);
assert.equal(shouldUseLiveCatalogDevProxy({ isDev: false, hostname: "localhost" }), true);
assert.equal(shouldUseLiveCatalogDevProxy({ isDev: false, hostname: "127.0.0.1" }), true);
assert.equal(shouldUseLiveCatalogDevProxy({ isDev: false, hostname: "estim8r.currentflowconsulting.org" }), false);

assert.equal(isStaticHostCatalogRejection({ status: 405 }, nginx405), true);
assert.equal(isStaticHostCatalogRejection({ status: 404 }, "<!doctype html>"), true);
assert.equal(isStaticHostCatalogRejection({
  status: 200,
  headers: { get: () => "text/html; charset=utf-8" },
}, "<html><title>Estim8r</title></html>"), true);
assert.equal(isStaticHostCatalogRejection({
  status: 200,
  headers: { get: () => "application/json" },
}, '{"results":[]}'), false);

console.log("live supplier catalog host checks passed");
