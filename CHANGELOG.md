# Changelog

Every change that goes live gets a new version (see "Versions" in README.md).

## 1.4.0 (2026-11-20)

* **Relays** (with TMS Truck 1.6.0): a dispatch split between two drivers shows each driver only their own leg.
  * The relay stop says what to do: **Drop trailer** or **Hook trailer** at a yard, or **Hand off** or **Take over** when the drivers meet, with the other driver's name and a button to call them when meeting.
  * At a hook, the seal put on at the pickup is shown, to check it is intact before leaving.
  * Relay stops have no BOL or POD photo, and a **RELAY** tag shows on the dispatch.

## 1.3.0 (2026-11-19)

* **Seal # when leaving a pickup:** the departure screen of a pickup has a **Seal #** box (filled in already when the office entered it). The seal goes to the office with the departure, also without signal, and shows with the BOL # at the top of the pickup. Needs TMS Truck 1.4.0.
* **Smaller BOL and POD photos:** a photo is made smaller step by step until it is about 350 KB or less, while the paper stays easy to read (at least 1200 pixels on its long side). A 4 to 5 MB phone photo now sends as about 200 to 300 KB, 20% to 50% smaller than before (the more detail in the photo, the more it saves), so it goes through faster on a weak signal and takes less space.

## 1.2.0 (2026-11-19)

* **BOL # at the pickup:** the bill of lading number shows in large type with the other numbers at the top of a pickup (from TMS Truck 1.3.0).

## 1.1.0 (2026-11-19)

* **The dock's numbers on each stop:** the **Release #** to pick up, the receiver's **Delivery PO #** and the **Appointment #** show in large type at the top of the stop, easy to read out at the shipping or receiving window.
* **Reefer details:** the temperature and whether the product is fresh, frozen or dry, and a **Pallet exchange** tag when the customer asks for one.
* **The customer's numbers:** the load's **PO #** and **Order #** next to the load number.
* Needs TMS Truck 1.2.0 for the new numbers; with an older TMS nothing changes.

## 1.0.1 (2026-11-18)

Fixes to the updates saved on the phone while there is no signal:

* **Nothing erased:** a stop update or check call tapped while the saved ones were being sent was erased from the phone and never reached the office. It is now sent with the others, in order.
* **Office server trouble:** when the server answered with an error of its own (a restart, for example), the saved update was thrown away. It now stays on the phone and is sent again, for up to 30 minutes.
* **Nothing sent twice:** two sends could start together and post the same check call twice. Only one runs at a time, and a send that hangs on a weak signal is given up after 45 seconds and tried again.
* With service, an update that waits behind others goes out right away instead of at the next check.

## 1.0.0 (2026-10-11)

First numbered version. What the TMS Driver app does today:

* Sign in with phone number and PIN.
* Each driver's own dispatches, with Arrived and Departed at each stop, check calls, BOL and POD photos.
* Works without signal: updates wait on the phone and are sent when service comes back.
* Version number on the sign in screen and at the bottom of the app, `/version.json`, and a "new version, tap to update" notice.
