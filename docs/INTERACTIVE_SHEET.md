# Interactive sheet

The takeoff studio keeps the drawing in the center. An uploaded drawing is interactive immediately. Tools sit in a narrow rail. Quantities, the symbol being marked, and file output are separate panels on the right. Page takeoff, AI for the current sheet, zoom, and review stay in the top bar.

- Symbol-sized geometry can be selected and classified in the inspector.
- Long thin geometry can be selected as a line. It stays out of the bid until a circuit is assigned.
- Closed room-sized geometry can be selected, named, and given a height. Area stays out of the bid until the room is named. The area tool fills the smallest printed room that contains the click.
- Each page has **Takeoff on this page**. A full AI run skips pages that are turned off. **AI: this sheet** still runs the page on screen.

Also on the sheet:

- Tool chest saves the current tool, color, and symbol on this device.
- Quantity link downloads the live takeoff as CSV for Excel, plus a SHA-256 checksum. The checksum is an integrity digest, not a certificate-backed digital signature.
- Slip sheets are named dividers stored with the session and listed in the quantity file.
- Share takeoff session downloads a JSON file another estimator can import. It is a file handoff, not a live multi-user session.
- Dropping several drawings queues the rest behind **Next drawing**.

Professional tools on the same sheet:

- Trade presets switch the active measurement tool. They do not invent labor units.
- Length, perimeter, area, and volume read from the selected mark when the sheet is calibrated. Volume uses the height you enter.
- Find similar geometry matches vector size on the open drawing. It is separate from the classified-symbol count.
- Crop to selection zooms and pans the sheet to the selected object.
- Save revision snapshot and Compare with snapshot report added, removed, and unchanged objects against that snapshot.
- Excel workbook downloads SpreadsheetML that Excel opens. Quantity link CSV remains available.
- Publish live quantities opens `/quantity-link` in another window on this browser and updates it over a same-origin channel.
- Sign quantity file writes an ECDSA P-256 signature with a device key stored in this browser. It is not a certificate from a public authority.
- Read scanned text runs Tesseract on the rendered sheet. Quality depends on the scan.
- Bill of materials PDF lists bid quantities. Unnamed geometry stays out.
- A formula accepts numbers, `qty`, `waste`, `count`, and `+ - * / ()`. The result is stored on the selected mark.
- Place assembly drops the chosen assembly on the next sheet click. Component labor stays marked for review.
- Side-by-side sheet shows another page of the same PDF beside the working sheet.
- Shared session id exchanges marks between tabs of this browser. A tab with no marks asks the other tab for the current takeoff. A tab that already has marks sends them when the session id is set and again after each edit.
- Aerial length uses OpenStreetMap tiles after you click Show. Two clicks store a ground length in feet. The default coordinates are not a job site.

These still need an outside service and are not pretended here:

- Simultaneous cloud markup across different computers
- A public certificate authority for digital identities
- Google Earth imagery
- A live Microsoft Excel COM add-in
- Physical blank pages inserted into the source PDF
- Automatic AI takeoff across every file in a dropped batch
