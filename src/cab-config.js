/* Cab Books settings for the website.
   geoapifyApiKey: 'server' means the Geoapify key is kept on Netlify (environment variable
   GEOAPIFY_API_KEY) and the fare calculator's routes go through /.netlify/functions/route,
   so the key is never in this public code. */
window.CB_CONFIG={geoapifyApiKey:'server'};
