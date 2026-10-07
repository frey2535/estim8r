import { defaultCrew, EMPLOYEE_CLASSES, SHOP_HOURLY_RATE } from "./employeeClasses.js";
import {
  defaultLaborRates,
  LEGACY_DEFAULT_WAGES,
  looksLikeLegacyDefaultRates,
  mergeLaborRates,
  ratesToWageBook,
  resolveShopRates,
  applyRatesToCrew,
} from "./rates.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(SHOP_HOURLY_RATE === 95, "shop rate is $95");
assert(EMPLOYEE_CLASSES.every((row) => row.defaultWage === 95), "every class defaults to $95");
assert(defaultCrew().every((row) => row.wage === 95), "default crew uses $95 for every class");
assert(defaultLaborRates().every((row) => row.hourlyRate === 95), "default labor rates are $95");

assert(looksLikeLegacyDefaultRates(LEGACY_DEFAULT_WAGES), "old $68-style wage book is legacy");
assert(looksLikeLegacyDefaultRates(Object.entries(LEGACY_DEFAULT_WAGES).map(([classId, hourlyRate]) => ({ classId, hourlyRate }))), "old $68-style rate rows are legacy");
assert(!looksLikeLegacyDefaultRates({ journeyman: 120 }), "a custom journeyman rate is not legacy");
assert(!looksLikeLegacyDefaultRates(defaultLaborRates()), "the $95 shop book is not legacy");

const fromLegacy = resolveShopRates(Object.entries(LEGACY_DEFAULT_WAGES).map(([classId, hourlyRate]) => ({ classId, hourlyRate })));
assert(fromLegacy.every((row) => row.hourlyRate === 95), "legacy stored rates become the $95 shop book");

const fromLegacyBook = resolveShopRates([], LEGACY_DEFAULT_WAGES);
assert(fromLegacyBook.every((row) => row.hourlyRate === 95), "legacy wage book becomes the $95 shop book");

const custom = resolveShopRates([{ classId: "journeyman", hourlyRate: 110 }], {});
assert(custom.find((row) => row.classId === "journeyman").hourlyRate === 110, "a saved custom rate is kept");
assert(custom.find((row) => row.classId === "helper").hourlyRate === 95, "unsaved classes stay at $95");

const merged = mergeLaborRates([{ classId: "foreman", hourlyRate: 88 }], { helper: 40 });
assert(merged.find((row) => row.classId === "foreman").hourlyRate === 88, "stored class wins");
assert(merged.find((row) => row.classId === "helper").hourlyRate === 40, "wage book fills missing classes");

const priced = applyRatesToCrew(defaultCrew(), defaultLaborRates({ journeyman: 101 }));
assert(priced.find((row) => row.id === "journeyman").wage === 101, "crew wages follow the shop book");
assert(ratesToWageBook(defaultLaborRates({ apprentice_1: 1 })).journeyman === 95, "wage book uses shop default for missing ids");

if (!process.exitCode) console.log("labor rates checks passed");
