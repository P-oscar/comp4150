# Connect the SQLbackend
1. In config.js, set mode to 'api' and apiBaseUrl to your API path, such as '/api'.
2. Serve this folder and the API from the same website. Open index.html through that website.
3. In service.js, change the API URLs and JSON fields to match your backend.
Return arrays for menu items, categories, and orders.
For login and session checks, return { "role": "staff", "name": "user1" }.
Supported roles are customer, staff, and manager.
To run without a backend, keep mode as 'demo' and open index.html.

