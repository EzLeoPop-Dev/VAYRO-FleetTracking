import { internalClient, internalToken } from "@vayro/service-kit";

// Tells other services that a new GPS point was stored (PDF page 21: send data on to Tracking, Route, Alert, Reporting).
// Tracking, Route History and Reporting read stored points on demand through /internal/locations*, so only a service that
// must react to each new point (Alert & Geofence: speed, geofence enter/exit) needs this push.
//
// Subscribers are listed in GPS_EVENT_SUBSCRIBERS (comma separated base URLs). Each one receives
//   POST <url>/internal/gps/locations   { event: "gps_location.stored", location: <the public GPS point, with anomalies> }
// with the internal token, so it must answer 2xx. Delivery is fire-and-forget: a slow or failing subscriber is logged and
// never delays or fails the device's request, and the point stays stored. A subscriber that needs every point should also
// catch up through GET /internal/locations.
export interface EventPublisher {
  locationStored(location: unknown): void;
}

export const noEvents: EventPublisher = { locationStored() {} };

export function httpEventPublisher(list = process.env.GPS_EVENT_SUBSCRIBERS ?? ""): EventPublisher {
  const urls = list.split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) return noEvents;
  const token = internalToken();
  const clients = urls.map((url) => ({ url: new URL(url).origin, call: internalClient(new URL(url).origin, token) })); // bad URL fails at startup
  return {
    locationStored(location) {
      for (const { url, call } of clients) {
        call("POST", "/internal/gps/locations", { body: { event: "gps_location.stored", location } })
          .then(({ status }) => { if (status < 200 || status >= 300) console.error(`event subscriber ${url} answered ${status}`); })
          .catch((err) => console.error(`event subscriber ${url} failed:`, err instanceof Error ? err.message : "unknown error"));
      }
    },
  };
}
