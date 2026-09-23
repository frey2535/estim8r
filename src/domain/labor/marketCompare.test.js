import { AUDITED_LABOR_ITEMS } from "./auditedLibrary.js";
import { applyLibraryItemToLine } from "../estimate/manualLineLabor.js";
import { buildLaborSourceOptions } from "./selection.js";
import { EXPERIMENTAL_LABOR_SOURCE, isVerifiedMarketReference, sourceBadges } from "./sources.js";
import {
  MARKET_COMPARE_WHY,
  NO_VERIFIED_MARKET_REFERENCE,
  compareEstimateToMarket,
  compareLineToMarket,
  flagLabel,
} from "./marketCompare.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

function line(overrides = {}) {
  return {
    id: "line-1",
    source: "manual",
    itemType: "Conduit",
    category: "EMT conduit",
    description: '1/2" EMT',
    quantity: 10,
    unit: "FT",
    materialUnitCost: 0,
    laborMhPerUnit: 0,
    laborRate: 68,
    included: true,
    laborMatchStatus: "",
    ...overrides,
  };
}

function publishedUnit(item, overrides = {}) {
  return {
    id: `${item.id}-rsmeans`,
    labor_item_id: item.id,
    source_type: "published_reference",
    source_name: "RSMeans",
    source_year: "2024",
    source_reference: "Electrical Cost Data 26 05 33",
    normal_mh: 0.04,
    difficult_mh: 0.055,
    very_difficult_mh: null,
    verification_status: "verified",
    production_allowed: true,
    notes: "Licensed published sample for tests only.",
    ...overrides,
  };
}

function withReference(item, overrides = {}) {
  return {
    ...item,
    labor_units: [...(item.labor_units || []), publishedUnit(item, overrides)],
  };
}

const emt = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00039");
const pvc = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00576");
const flood = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-01527");
assert(emt && pvc && flood, "workbook still has EMT, PVC, and flood rows");

assert(AUDITED_LABOR_ITEMS.length === 1921, `1921 imported rows, got ${AUDITED_LABOR_ITEMS.length}`);
assert(
  AUDITED_LABOR_ITEMS.every((row) => !row.labor_units.some((unit) => isVerifiedMarketReference(unit))),
  "no imported unit is a verified market reference",
);
assert(
  AUDITED_LABOR_ITEMS.every((row) => row.labor_units.every((unit) => unit.source_type === "experimental")),
  "imported units stay experimental",
);

const empty = compareLineToMarket(line({ laborItemId: "", quantity: 1, unit: "EA" }), null);
assert(empty.message === NO_VERIFIED_MARKET_REFERENCE, empty.message);
assert(empty.hasReference === false, "empty line has no market reference");
assert(!/neca/i.test(`${empty.source.sourceName}${empty.reference?.sourceName || ""}`), "empty compare is not labeled NECA");

const unmatched = compareLineToMarket({
  ...line({ laborItemId: "EL-missing", laborMatchStatus: "unmatched", laborMhPerUnit: 0 }),
}, null);
assert(unmatched.message === NO_VERIFIED_MARKET_REFERENCE, "unmatched says no verified market reference");
assert(unmatched.source.badges.includes("UNVERIFIED"), "unmatched is UNVERIFIED");

const picked = applyLibraryItemToLine(line(), emt);
const experimentalCompare = compareLineToMarket(picked, emt);
assert(experimentalCompare.source.badges.includes("ESTIM8R"), `badges ${experimentalCompare.source.badges}`);
assert(experimentalCompare.source.badges.includes("UNVERIFIED"), "experimental is UNVERIFIED");
assert(experimentalCompare.message === NO_VERIFIED_MARKET_REFERENCE, "experimental hours are not a market average");
assert(experimentalCompare.estimateHours === 3.8, `stick hours ${experimentalCompare.estimateHours}`);
assert(!/neca/i.test(`${experimentalCompare.source.sourceName}${experimentalCompare.reference?.sourceName || ""}`), "experimental compare is not labeled NECA");
assert(MARKET_COMPARE_WHY.includes("1,921"), "why text names the imported rows");

const options = buildLaborSourceOptions({ laborItem: emt });
assert(options[0].available === false && options[0].mh == null, "bundled published slot stays empty");
assert(options[0].warning.includes("No verified market reference"), options[0].warning);
assert(!/neca/i.test(options[0].sourceName || ""), "empty published slot is not named NECA");

const necaUnit = publishedUnit(emt, { source_name: "NECA Manual of Labor Units", source_reference: "NECA 2024" });
assert(!isVerifiedMarketReference(necaUnit), "NECA is rejected while unlicensed");
assert(isVerifiedMarketReference(necaUnit, { licensedNeca: true }), "licensed NECA can be a reference");
const necaItem = withReference(emt, { source_name: "NECA Manual of Labor Units" });
const necaCompare = compareLineToMarket(picked, necaItem);
assert(necaCompare.message === NO_VERIFIED_MARKET_REFERENCE, "unlicensed NECA is not shown as market");
assert(!/neca/i.test(JSON.stringify(necaCompare.reference)), "unlicensed NECA is not labeled on the line");

assert(!isVerifiedMarketReference(publishedUnit(emt, { source_year: "" })), "edition/year is required");
assert(!isVerifiedMarketReference(publishedUnit(emt, { source_name: "" })), "named source is required");
assert(!isVerifiedMarketReference(publishedUnit(emt, { verification_status: "unverified" })), "unverified published is not market");
assert(!isVerifiedMarketReference(publishedUnit(emt, { production_allowed: false })), "unpublished verified hours are not market");
assert(!isVerifiedMarketReference({
  source_type: "company_history",
  source_name: "Company history",
  source_year: "2024",
  verification_status: "verified",
  production_allowed: true,
  normal_mh: 0.03,
}), "company history is not a published market reference");
assert(!isVerifiedMarketReference({
  source_type: "custom",
  source_name: "Custom labor",
  source_year: "2024",
  verification_status: "verified",
  production_allowed: true,
  normal_mh: 0.02,
}), "custom labor is not a published market reference");
assert(!isVerifiedMarketReference(emt.labor_units[0]), "Estim8r experimental unit is not market");

const referencedItem = withReference(emt);
const withMarket = compareLineToMarket(picked, referencedItem);
assert(withMarket.hasReference, "verified RSMeans is a market reference");
assert(withMarket.reference.sourceName === "RSMeans", withMarket.reference.sourceName);
assert(withMarket.reference.edition === "2024", withMarket.reference.edition);
assert(withMarket.reference.badge === "REFERENCE", withMarket.reference.badge);
assert(withMarket.reference.hours === 4, `100 LF × 0.04 = 4, got ${withMarket.reference.hours}`);
assert(withMarket.reference.hoursLow === 4, `low ${withMarket.reference.hoursLow}`);
assert(withMarket.reference.hoursHigh === 5.5, `100 LF × 0.055 = 5.5, got ${withMarket.reference.hoursHigh}`);
assert(withMarket.estimateHours === 3.8, "estimate still uses stick × 10' experimental hours");
assert(withMarket.flag === "low", `3.8 vs 4–5.5 should be low, got ${withMarket.flag}`);
assert(withMarket.reference.labor === 272, `4 hrs × $68 = 272, got ${withMarket.reference.labor}`);
assert(flagLabel(withMarket.flag) === "Low vs reference", flagLabel(withMarket.flag));

const highLine = { ...picked, laborMhPerUnit: 0.08, laborMhEdited: true };
const highCompare = compareLineToMarket(highLine, referencedItem);
assert(highCompare.estimateHours === 8, `override hours ${highCompare.estimateHours}`);
assert(highCompare.flag === "high", "8 hrs vs 4–5.5 is high");

const inLine = { ...picked, laborMhPerUnit: 0.045, laborMhEdited: true };
assert(compareLineToMarket(inLine, referencedItem).flag === "in_line", "4.5 hrs is inside 4–5.5");

const twoRefs = {
  ...emt,
  labor_units: [
    ...emt.labor_units,
    publishedUnit(emt),
    publishedUnit(emt, {
      id: `${emt.id}-craftsman`,
      source_name: "Craftsman",
      source_year: "2023",
      normal_mh: 0.042,
      difficult_mh: null,
    }),
  ],
};
const sideBySide = compareLineToMarket(picked, twoRefs);
assert(sideBySide.references.length === 2, `two published sources, got ${sideBySide.references.length}`);
assert(sideBySide.references.map((row) => row.sourceName).join(",") === "RSMeans,Craftsman", "side-by-side names both publishers");

const publishedOptions = buildLaborSourceOptions({ laborItem: referencedItem });
assert(publishedOptions[0].available === true && publishedOptions[0].mh === 0.04, "selector shows verified published MH");
assert(publishedOptions[0].sourceName === "RSMeans", publishedOptions[0].sourceName);
assert(publishedOptions[0].sourceYear === "2024", publishedOptions[0].sourceYear);
assert(publishedOptions[0].badges.includes("REFERENCE"), "published option is REFERENCE");
assert(publishedOptions[2].sourceType === "experimental" && publishedOptions[2].mh === 0.038, "experimental stays beside the reference");

const takeoffLine = {
  id: "takeoff-emt",
  source: "takeoff",
  itemType: "Conduit",
  category: "Raceway",
  description: 'EMT 3/4"',
  quantity: 200,
  unit: "LF",
  laborItemId: "EL-00050",
  laborMhPerUnit: 0.05,
  laborRate: 68,
  included: true,
  laborMatchStatus: "matched",
  laborSource: EXPERIMENTAL_LABOR_SOURCE.name,
  laborSelection: { selectedSource: "experimental", verificationStatus: "unverified", sourceName: EXPERIMENTAL_LABOR_SOURCE.name },
};
const takeoffItem = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00050");
const takeoffCompare = compareLineToMarket(takeoffLine, takeoffItem);
assert(takeoffCompare.message === NO_VERIFIED_MARKET_REFERENCE, "takeoff experimental is not a market average");
assert(takeoffCompare.estimateHours === 10, `200 LF × 0.05 = 10, got ${takeoffCompare.estimateHours}`);

const blankEstimate = compareEstimateToMarket({ lines: [line({ laborItemId: "" })] }, AUDITED_LABOR_ITEMS);
assert(blankEstimate.message === NO_VERIFIED_MARKET_REFERENCE, "blank estimate has no market rollup");
assert(blankEstimate.flag === "none", "do not flag when there is no reference");

const mixed = compareEstimateToMarket({
  itemized: true,
  lines: [
    picked,
    applyLibraryItemToLine(line({ id: "line-2", quantity: 2, unit: "EA", itemType: "Fixture", category: "Lighting" }), flood),
    { ...picked, id: "line-3", included: false },
  ],
}, [referencedItem, flood]);
assert(mixed.lineCount === 2, "itemized omitted line is excluded");
assert(mixed.referencedLineCount === 1, "only the line with RSMeans is in the rollup");
assert(mixed.hasReference, "mixed estimate still reports the verified subset");
assert(mixed.comparableHours === 3.8, `comparable hours ${mixed.comparableHours}`);
assert(mixed.estimateHours > mixed.comparableHours, "full estimate hours include unmatched/experimental lines");
assert(mixed.flag === "low", "flag uses referenced lines only");
assert(mixed.message.includes("1 of 2"), mixed.message);

assert(sourceBadges({ sourceType: "experimental", verificationStatus: "unverified" }).join() === "ESTIM8R,UNVERIFIED", "ESTIM8R badge");
assert(sourceBadges({ sourceType: "published_reference", verificationStatus: "verified" }).join() === "REFERENCE", "REFERENCE badge");
assert(sourceBadges({ sourceType: "company_history", verificationStatus: "unverified" }).join() === "COMPANY,UNVERIFIED", "COMPANY badge");
assert(sourceBadges({ sourceType: "custom", verificationStatus: "unverified" }).join() === "CUSTOM,UNVERIFIED", "CUSTOM badge");

if (!process.exitCode) console.log("labor market compare checks passed");
