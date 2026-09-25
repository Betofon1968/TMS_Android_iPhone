# TMS Driver (TMS_Android_iPhone)

The phone app for drivers of **TMS Truck**. It works on **Android and iPhone** as an installable web app: drivers open a link, add it to the home screen, and it opens like any other app with its own icon.

It talks to the TMS server from the **TMS** repository, which holds all the data. This repository is only the driver app.

## What drivers can do

* Sign in with their **phone number and PIN** (the office sets the PIN on Trucks & Drivers in the TMS).
* See **their own dispatches**: current stop large on screen, address, appointment window, load number, PO, pieces, weight, and dock instructions.
* Tap **Arrived**, then **Loaded & departed** or **Delivered & departed** at each stop, in order. The time and GPS location go to the office.
* Send a **check call** (note plus location) to the office.
* Take **BOL and POD photos**; they are made smaller before sending so they upload on a weak signal.
* **Call** the stop contact or **navigate** there with one tap.
* Keep working **without signal**: stop updates and check calls are saved on the phone and sent automatically, with the time they were tapped, when service comes back. Photos need a signal.

Drivers never see rates, revenue, customers, or invoices; the TMS server only sends what a driver needs.

## Run it on your computer

You need Node.js 20.19 or newer and the TMS repository running.

1. In the **TMS** folder: `npm run dev` (starts the TMS server on port 3001 and the office app).
2. In this folder:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:5174. Set a PIN for a driver in the office app first (Trucks & Drivers, Drivers tab).

`npm test` runs the tests. `npm run build` makes the files to publish in `dist/`.

## Put it online

The app is a static website, so hosting is simple and inexpensive. With Render:

1. Put the TMS online first (see DEPLOY.md in the TMS repository) and note its address, for example `https://tms-truck.onrender.com`.
2. In Render, click **New**, then **Blueprint**, and pick this repository. It reads `render.yaml`.
3. When asked for **VITE_TMS_API_URL**, enter the TMS address from step 1 (no slash at the end).
4. Deploy. Render gives the app its own address, for example `https://tms-driver.onrender.com`.
5. In Render, open the **TMS** web service, go to **Environment**, set **DRIVER_APP_URL** to the driver app address from step 4, and save. The TMS only accepts the driver app from that address.
6. In the office app, Trucks & Drivers now shows this link to send to drivers.

Any other static host works too (Netlify, Cloudflare Pages, Vercel): build with `npm run build`, publish the `dist` folder, set `VITE_TMS_API_URL` at build time, and send every page to `index.html`.

If you change the TMS address later, update `VITE_TMS_API_URL` and publish again (the address is built into the app).

## Install on a phone

* **iPhone:** open the link in **Safari**, tap **Share**, then **Add to Home Screen**.
* **Android:** open the link in **Chrome**, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).

Allow location when asked. The location is only read when the driver taps a stop button or sends a check call. GPS and installing need the online (https) address; they do not work over plain http on your local network.

## How it connects to the TMS

* The driver signs in with phone number and PIN; the TMS returns a sign in token that is kept on the phone and sent with every request (`Authorization: Bearer`). Phones block cookies between different web addresses, so a token is used instead.
* The TMS accepts driver requests from browsers only from the addresses in its `DRIVER_APP_URL` and `DRIVER_APP_ORIGINS` settings. Office data is never available to the driver app.
* When the office resets a driver's PIN or turns the app off, the token stops working and the driver is asked to sign in again.

## Files

```
src/DriverApp.jsx   screens: sign in, dispatch list, current stop, route, check call, photos
src/queue.js        updates saved on the phone while offline, sent in order later
src/offline.js      shows saved updates on screen right away
src/lib/api.js      connection to the TMS server and the sign in token
src/lib/images.js   shrinks photos before upload
public/             icons, app manifest, and the offline cache (sw.js)
render.yaml         hosting setup for Render
```
