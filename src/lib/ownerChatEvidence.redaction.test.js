import { strict as assert } from "node:assert";
import { redactOwnerDiagnostic } from "./ownerChatEvidence.js";
assert.equal(redactOwnerDiagnostic("Authorization: Bearer abc123"), "Authorization: Bearer [REDACTED]");
assert.equal(redactOwnerDiagnostic("token=abc123"), "token=[REDACTED]");
assert.equal(redactOwnerDiagnostic("password: verysecret"), "password: [REDACTED]");
assert.equal(redactOwnerDiagnostic("Normal error"), "Normal error");
console.log("Owner diagnostic redaction checks passed");
