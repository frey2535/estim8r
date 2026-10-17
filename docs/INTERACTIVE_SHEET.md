# Interactive sheet

An uploaded drawing opens in the takeoff workspace immediately. Pan, zoom, and the takeoff tools are available before AI assist runs. A PDF vector layer is read in the background and becomes selectable geometry:

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

These are not in the product because they would require an external service or would pretend to work:

- Simultaneous cloud markup sessions
- Certificate digital identities
- Google Earth aerial imagery
- OCR of a scanned sheet with no vector layer
- A live Microsoft Excel add-in connection
