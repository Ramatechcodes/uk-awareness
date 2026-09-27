# RamatechCode Location Tracker

## Important location requirement
A browser cannot provide an exact GPS address unless the person using the tracking link explicitly grants location permission. The app does not and cannot bypass a browser's "Request denied" decision.

For production, deploy the app over HTTPS. Render provides HTTPS automatically.

## Flow
1. Pay for a tracking session.
2. The success page gives an **Access Code** for the dashboard and a separate **Tracking Link**.
3. Send the Tracking Link to the person whose location should be shared.
4. They open the link and see the registration form.
5. They can enable **Share my current location**; the browser then asks for permission.
6. Their browser requests GPS permission.
7. GPS coordinates are sent to the server together with the registration.
8. The server reverse-geocodes the coordinates to an address using Google Geocoding when `GOOGLE_API_KEY` is configured, otherwise OpenStreetMap Nominatim.
9. The dashboard displays registrations, coordinates, GPS accuracy, address, map, and Google Maps links.

## Environment variables
MONGO_URI=your_mongodb_connection_string
FLUTTERWAVE_SECRET=your_flutterwave_secret
GOOGLE_API_KEY=optional_google_geocoding_key
ADMIN_PIN=your_admin_pin
APP_URL=https://your-render-domain.onrender.com

## If the user sees "Request denied"
- Tap the browser's location/permission icon and allow location for the site.
- On Android/iPhone, enable Location Services for the browser.
- Reload the tracking link after changing permission.
- Use HTTPS. `http://localhost` is allowed for development, but a public website should use HTTPS.
- The person must press the location button and grant permission.

## Exact address limitation
GPS gives latitude/longitude and an accuracy estimate. The address is a reverse-geocoded interpretation of those coordinates. It may be a nearby street/building address rather than a guaranteed exact apartment/house unit.

## Start
npm install
npm start


## Environment variables
Use these variables on Render: `FLUTTERWAVE_SECRET`, `GOOGLE_API_KEY`, `MONGO_URI`, `PORT`, `ADMIN_PIN`, and optionally `APP_URL`.

`SESSION_DURATION_MINUTES` controls how long a paid tracking link remains active. If omitted, it defaults to 1440 minutes (24 hours). For example:
`SESSION_DURATION_MINUTES=1440`

Do not put API keys or database passwords in source code or commit them to GitHub.
