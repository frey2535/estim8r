import {
  fillEmptyHeader,
  headerFromDrawings,
  headerFromFileName,
  headerFromMarkup,
  parseTitleBlock,
  titleBlockForMarkup,
} from "./fromDrawings.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const COVER_TITLE_BLOCK = `
6 7 8
Shelbyville
Multipurpose
Soccer Field
Complex Pavilion
220 Tulip Tree Rd,
Shelbyville, TN 37160
CITY OF SHELBYVILLE
201 N Spring Street,
Shelbyville, TN 37160
WOLD ARCHITECTS
AND ENGINEERS
214 Centerview Drive Suite 300
Brentwood, Tennessee 37027
woldae.com | 615 370 8500
Comm: 257031
Date: 08-28-2026
Drawn: YJR
Check: JR
TITLE SHEET
A0.00
`;

const labeled = parseTitleBlock(`
PROJECT: West High Additions
OWNER: Acme School District
CONTACT: Jane Doe
PHONE: (931) 555-0142
EMAIL: jane.doe@acme.k12.tn.us
ADDRESS:
100 Main Street
Shelbyville, TN 37160
`);

const fromCover = parseTitleBlock(COVER_TITLE_BLOCK);
assert(fromCover.customerCompany === "CITY OF SHELBYVILLE", `company ${fromCover.customerCompany}`);
assert(fromCover.projectAddress === "220 Tulip Tree Rd, Shelbyville, TN 37160", `address ${fromCover.projectAddress}`);
assert(fromCover.customerPhone === "615-370-8500", `phone ${fromCover.customerPhone}`);
assert(fromCover.customerEmail === "", "cover sheet has a website, not an email");
assert(fromCover.customerName === "", "drafter initials are not a contact name");
assert(fromCover.projectName === "Shelbyville Multipurpose Soccer Field Complex Pavilion", `name ${fromCover.projectName}`);
assert(fromCover.estimateNumber === "257031", `comm ${fromCover.estimateNumber}`);
assert(!fromCover.projectAddress.includes("Spring Street"), "owner hall is not the project address");
assert(!fromCover.projectAddress.includes("Centerview"), "architect office is not the project address");

assert(labeled.customerCompany === "Acme School District", "labeled owner");
assert(labeled.customerName === "Jane Doe", "labeled contact");
assert(labeled.customerPhone === "931-555-0142", `labeled phone ${labeled.customerPhone}`);
assert(labeled.customerEmail === "jane.doe@acme.k12.tn.us", "labeled email");

const notesPhone = parseTitleBlock("AUTHORITY HAVING JURISDICTION\nSHELBYVILLE BUILDING & CODES\nPH: (931) 735-4230");
assert(notesPhone.customerCompany === "", "AHJ notes are not the owner title block");

const markup = headerFromMarkup({
  kind: "markup-pages",
  fileName: "257031-Soccer Pavilion-DRAWINGS.pdf",
  titleBlock: {
    customerCompany: "CITY OF SHELBYVILLE",
    customerName: "Jane Doe",
    customerPhone: "615-370-8500",
    customerEmail: "jane.doe@example.com",
    projectAddress: "220 Tulip Tree Rd, Shelbyville, TN 37160",
  },
});
assert(markup.customerCompany === "CITY OF SHELBYVILLE", "markup company");
assert(markup.customerName === "Jane Doe", "markup contact");
assert(markup.customerEmail === "jane.doe@example.com", "markup email");

const fromFile = headerFromFileName("257031-Soccer Pavilion-DRAWINGS.pdf");
assert(fromFile.estimateNumber === "257031", "filename job number");
assert(fromFile.projectName === "Soccer Pavilion", `filename name ${fromFile.projectName}`);

const merged = headerFromDrawings({
  fileName: "257031-Soccer Pavilion-DRAWINGS.pdf",
  drawingDocs: { titleBlock: fromCover },
  markup: { fileName: "257031-Soccer Pavilion-DRAWINGS.pdf" },
});
assert(merged.customerCompany === "CITY OF SHELBYVILLE", "title block wins over empty markup");
assert(merged.customerEmail === "", "no invented email");

const kept = fillEmptyHeader({
  projectName: "Manual name",
  customerCompany: "Manual Co",
  projectAddress: "",
}, fromCover, { fileName: "257031-Soccer Pavilion-DRAWINGS.pdf" });
assert(kept.projectName === "Manual name", "typed project name is kept");
assert(kept.customerCompany === "Manual Co", "typed company is kept");
assert(kept.projectAddress === fromCover.projectAddress, "blank address is filled");

const upgraded = fillEmptyHeader({
  projectName: "257031-Soccer Pavilion-DRAWINGS",
}, fromCover, { fileName: "257031-Soccer Pavilion-DRAWINGS.pdf" });
assert(upgraded.projectName === fromCover.projectName, "filename stem is replaced by the title block");

assert(titleBlockForMarkup({ projectName: "" }) === null, "empty header is not written onto markup");
assert(titleBlockForMarkup(fromCover).customerCompany === "CITY OF SHELBYVILLE", "markup copy keeps extracted fields");

if (!process.exitCode) console.log("drawing header checks passed");
