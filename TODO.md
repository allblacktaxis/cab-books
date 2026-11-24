# Cab Books – shared to-do list

Read this at the start. Tick off (`[x]`) what you finish, and add anything new Matt asks for.
Before adding an item, check the code and git log so nothing already done is listed.

## To check on the live app
- [ ] Voice entry ("Say jobs"): on 11 Nov it heard nothing. The microphone fix went in after that, so check it now hears speech.
- [ ] Uber March figures: fares £1,276.70, Quest £150, tips £43.83.
- [ ] Knowledge route on Tools → Shortest.
- [ ] Import tab on iPhone: tap a date box or a bank-line drop-down, then scroll. The bottom bar should stay at the bottom (fixed 18 Nov).
- [ ] Toilets and Ranks maps: pinch to zoom and drag with one finger. The map should move (fixed 24 Nov).
- [ ] Receipts: make one with "Discount in £" (e.g. £10 off) and one with "Discount as %". Check the totals, the PDF and "Copy as text" (added 24 Nov).

## Waiting on Matt / accountant
- [ ] Real cash fares (October onward).
- [ ] Are Uber Quest, the £500 sign-up promotion and referral rewards VAT turnover?
- [ ] Curb "Manual Payments": £50 (18 Apr), £5 (30 May), £375 (17 Jun). What were they?
- [ ] What the payments to Marcin and Daniel Bowry were for.
- [ ] ICO registration.
- [ ] Add Claude and Netlify costs as business expenses.

## Waiting on Marcin
- [ ] A sample FreeNow booking-record CSV. Then fix the misleading "not a Curb report" message it gives.
- [ ] Link Cab Books from TaxiTracker.

## Build next
- [ ] How to download each provider's files, in the guide (help.html, section 9). Bank, FreeNow, Gett, Uber and Curb were already there.
  - [x] Heathrow drop-offs (18 Nov)
  - [ ] ComCab: driver statement PDF and pay sheet spreadsheet. Matt to say where he downloads them.
  - [ ] Taxiworld: "Payment from Taxiworld" PDFs. Matt to say where they come from.
  - [ ] Point the setup checklist's ComCab and Taxiworld "how to" links at their own sections.
- [ ] Reminders: a "To do" card on Today, month-end close nudges, unpaid receipts, set-aside shortfall. (The weekly statement reminder per app is already built.)
- [ ] Events alerts: phone alerts for venues the driver ticks. Go through the venue and annual events list with Matt first.
- [ ] Toilet door codes on the Toilets map, shared between drivers ("Code worked" / "Code changed").
- [ ] Monday summary notification.
- [ ] Match bank payments to unpaid receipts.

## Videos
- [ ] Matt to review every guide video so far (open the guide, tap each "Watch a short video"): 5.1 Add a job, 5.2 Position, 5.3 Reports, 5.4 Tonight, Flights, Trains and Tube, 7 Fixing mistakes (edit and delete a job). Add new ones here as they are made.
- [x] Captions or voice-over? Matt (11 Nov): silent is fine. Each guide section gets a "Watch a short video" button.
- [ ] Short silent walkthroughs in the guide, recorded on a test copy of the app with a pretend driver (no real data):
  - [x] Add a job (guide 5.1)
  - [x] Position and the VAT limit (guide 5.2)
  - [x] Reports (guide 5.3)
  - [ ] Sign up and Quick setup
  - [ ] Home screen icon
  - [ ] Train alerts
  - [ ] Bank statement
  - [ ] App statements
  - [ ] Receipt photos
  - [x] Tonight, Flights, Trains, Tube (guide 5.4, recorded with live data on 24 Nov)
  - [ ] Fares, Ranks, Toilets: blocked. The test computer can't reach the map server (taxitrackermap.allblacktaxis.co.uk). Add it under Allowed domains in the cloud environment's network settings, then record.
  - [x] Fixing mistakes: edit and delete a job (guide 7)
- [ ] A longer "How to use Cab Books" video for drivers (Matt, 11 Nov).

## Getting started guide run-through with Matt (help.html)
Work is on branch `claude/zen-bohr-kkfepw` until Matt says "deploy".
- [x] Top: privacy box; Open Cab Books opens in a new tab
- [x] 1. Sign up
- [x] 2. Home screen: icon picture, "go back to your home screen" step
- [x] 3. Quick setup: Basic and Full explained (Cab Books doesn't send anything to HMRC), card provider not listed, earlier takings
- [x] 4. Train alerts
- [x] 8. Bank statement (was 5): moved down, Full only, privacy reminder, CSV or Excel, real button name, bank replaces typed expenses, once a month
- [ ] 9. App statements (was 6): moved down; still to review with Matt
- [x] 5. Everyday use (was 7): 1 Adding a job, 2 Position, 3 Reports, 4 Handy screens (map videos still to do, see Videos)
- [x] 6. Receipt photos (was 8) (reviewed; Add an expense → Cash)
- [x] 7. Fixing mistakes (was 9): current Settings paths, Update job, Tap again to delete, backup, contact us

## Later / parked
- [ ] Bank statement PDFs (NatWest first).
- [ ] Subscriptions (set up the separate company first).
- [ ] Make the repo private again (install the Claude GitHub App at the same time).
- [ ] Uber Driver API link.
- [ ] Shared bookings calendar for Matt and Marcin.
- [ ] £ per hour by provider.
