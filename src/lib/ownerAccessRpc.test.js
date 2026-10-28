import { describeAccessRpcError, isMissingRpcError } from "./ownerAccessRpc.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isMissingRpcError({ code: "PGRST202", message: "Could not find the function" }), "PGRST202 is missing RPC");
assert(isMissingRpcError({ message: "function public.delete_estim8r_access(text) does not exist" }), "missing function text");
assert(!isMissingRpcError({ message: "Only the platform owner can manage" }), "auth errors are not missing RPC");
assert(
  /Apply supabase\/migrations\/20261028180000_delete_reinstate_estim8r_access\.sql/.test(
    describeAccessRpcError({ code: "PGRST202", message: "Could not find the function" }, "delete"),
  ),
  "missing delete RPC tells the operator which SQL to apply",
);

if (!process.exitCode) console.log("owner access RPC helper checks passed");
