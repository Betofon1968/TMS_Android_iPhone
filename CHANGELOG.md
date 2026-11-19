# Changelog

Every change that goes live gets a new version (see "Versions" in README.md).

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
