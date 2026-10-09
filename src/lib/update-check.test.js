import {
  buildVersionUrls,
  checkForEstim8rUpdate,
  decideUpdatePrompt,
  fetchRemoteBuildSha,
  shouldPromptForRemoteSha,
} from "./update-check.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(shouldPromptForRemoteSha("aaa", "bbb") === true, "different SHA must prompt");
assert(shouldPromptForRemoteSha("aaa", "aaa") === false, "same SHA does not prompt");
assert(shouldPromptForRemoteSha("", "bbb") === false, "empty running SHA does not prompt");
assert(shouldPromptForRemoteSha("aaa", "") === false, "empty remote SHA does not prompt");
assert(shouldPromptForRemoteSha("local", "bbb") === false, "local builds skip remote prompt");
assert(shouldPromptForRemoteSha("%ESTIM8R_BUILD_SHA%", "bbb") === false, "unreplaced token skips remote prompt");

assert(
  decideUpdatePrompt({ currentSha: "oldsha", remoteSha: "newsha", appliedSha: "oldsha" }).reason === "newer-build",
  "remote differ is newer-build even when applied matches running",
);
assert(
  decideUpdatePrompt({ currentSha: "oldsha", remoteSha: "newsha", appliedSha: "oldsha" }).targetSha === "newsha",
  "popup targets the live SHA",
);
assert(
  decideUpdatePrompt({ currentSha: "same", remoteSha: "same", appliedSha: "same" }).prompt === false,
  "matching live and running SHA stays quiet",
);
assert(
  decideUpdatePrompt({ currentSha: "same", remoteSha: "same", appliedSha: "" }).reason === "this-build",
  "unapplied current build still announces",
);
assert(
  decideUpdatePrompt({ currentSha: "oldsha", remoteSha: "newsha", promptedSha: "newsha" }).prompt === false,
  "already prompted remote SHA is not repeated",
);
assert(
  decideUpdatePrompt({ currentSha: "oldsha", remoteSha: "", appliedSha: "oldsha" }).prompt === false,
  "failed fetch does not fake a newer build",
);

const urls = buildVersionUrls(1_700_000_000_000, "abc");
assert(urls[0] === "/build-version.json?t=1700000000000&n=abc", "relative version url is cache-busted");
assert(urls.every((url) => url.includes("build-version.json") && url.includes("t=")), "every version url busts cache");

const okFetch = async () => ({
  ok: true,
  json: async () => ({ sha: "28cb44ac7fe4380e07eaec43be63bfb697d681bb" }),
});
assert(
  (await fetchRemoteBuildSha(okFetch)) === "28cb44ac7fe4380e07eaec43be63bfb697d681bb",
  "fetchRemoteBuildSha reads sha",
);

let attempts = 0;
const flakyFetch = async () => {
  attempts += 1;
  if (attempts < 2) throw new Error("stale cache");
  return { ok: true, json: async () => ({ sha: "freshsha" }) };
};
assert((await fetchRemoteBuildSha(flakyFetch)) === "freshsha", "fetch retries after a failed cache-bust");

const decided = await checkForEstim8rUpdate({
  currentSha: "phonesha",
  appliedSha: "phonesha",
  fetchImpl: async () => ({ ok: true, json: async () => ({ sha: "livesha" }) }),
});
assert(decided.prompt === true, "check prompts when live SHA differs");
assert(decided.reason === "newer-build", "check reason is newer-build");
assert(decided.targetSha === "livesha", "check target is the live SHA");

const quiet = await checkForEstim8rUpdate({
  currentSha: "livesha",
  appliedSha: "livesha",
  fetchImpl: async () => ({ ok: true, json: async () => ({ sha: "livesha" }) }),
});
assert(quiet.prompt === false, "check stays quiet when SHAs match");

if (!process.exitCode) console.log("update-check ok");
