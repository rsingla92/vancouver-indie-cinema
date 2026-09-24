# Step 2 — Hidden API Hunt

Investigation date: 2026-09-21. This document contains read-only findings and a capture protocol. It deliberately contains no extractor implementation.

## How to capture a candidate request

In Chrome or Edge:

1. Open DevTools → **Network** before loading the venue page.
2. Enable **Preserve log** and **Disable cache**.
3. Select **Fetch/XHR**, then reload the page.
4. Clear the log and perform one action at a time: next month, next page, open one film, or reveal additional dates.
5. For a promising request, save:
   - Request URL and method
   - Query string or POST payload
   - Response body and `Content-Type`
   - Relevant response headers (`ETag`, `Last-Modified`, cache controls)
   - Whether cookies, a nonce, or authorization headers are required
6. Right-click the request → **Copy → Copy as cURL** and **Copy response**. Redact cookies and analytics identifiers before sharing.

Reject analytics, ad, newsletter, CAPTCHA, and payment calls. A schedule source should return titles, dates/times, venue/session identifiers, detail URLs, or ticket URLs without requiring checkout state.

## Source matrix

| Venue | Observed architecture | Best first source | Confidence |
|---|---|---|---|
| Rio Theatre | WordPress + custom `barker-events` plugin | Plugin REST/AJAX request used by calendar navigation | High |
| The Park Theatre | Expected to match the Rio (same operator since December 2025) | Same Barker listings request on `theparktheatre.ca` | Medium, unverified |
| The Cinematheque | Server-rendered film/calendar pages + Vista Websales ticket links | Film/calendar HTML; Vista `evtinfo` as ticket session ID | High |
| VIFF Centre | WordPress listings + Elevent embedded booking widget | Server-rendered What's On pages; Elevent only for availability/detail gaps | High |
| Hollywood Theatre | Webflow CMS + Finsweet CMS pagination | Webflow listing HTML and pagination URLs | High |

## Rio Theatre

### Observed

- `https://riotheatre.ca/calendar/` renders a client-side monthly schedule.
- The page loads `wp-content/plugins/barker-events/assets/dist/js/frontend.min.js`.
- Inline configuration exposes:
  - `ajaxUrl`: `https://riotheatre.ca/wp-admin/admin-ajax.php`
  - `restBaseUrl`: `https://riotheatre.ca/wp-json/`
  - a WordPress REST nonce
  - the venue timezone offset
- Moving through the calendar updates event cards containing a title and local showtime.
- Event detail pages use `/movie/{slug}/` or `/event/{slug}/`; ticket CTAs often deep-link to `riotheatretickets.ca/events/{numeric-id}-{slug}`.

### Network-tab target

Filter with:

```text
wp-json OR admin-ajax OR barker OR event OR calendar
```

Then clear the log and click the calendar’s **next-month** arrow once. The desired request should contain a month/date range or pagination parameters and return event objects or rendered event fragments.

Capture these response fields if present:

- stable event/post ID
- title and slug
- start/end datetime and timezone
- event type (`movie` versus other event)
- detail URL
- ticket URL or ticket-platform event ID
- image/poster URL
- status/cancellation information

### Decision gate

Prefer a public GET REST route that works without a nonce. If the only source is `admin-ajax.php`, determine the `action` value and whether the nonce is actually validated. Do not persist or replay a short-lived browser nonce in production. If the JSON response omits ticket links, combine the schedule endpoint with the public detail page rather than scraping the visual calendar grid.

## The Park Theatre

### Observed

- Cineplex gave up the lease in October 2025; the theatre reopened in December 2025 under the Rio's management (Chris Ferguson, Oddfellows Pictures) with 4K laser and 70mm projection.
- The public site is `https://www.theparktheatre.ca/`.
- The site has not been inspected from this repository yet. Because it shares an operator with the Rio, the worker assumes the same WordPress + Barker stack and requests `/wp-json/barker/v1/listings` with the Rio's parameters.

### Network-tab target

Repeat the Rio procedure on the Park's calendar page and confirm the `barker` request exists, returns the same listing shape (`id`, `event.title`, `event.link`, `start_time`, `end_time`, `extra`, `premiere`, `tickets_link`), and needs no nonce.

### Decision gate

If the Park's site does not expose the Barker endpoint, the `park-theatre` ingestion run will record a failed run without affecting the other venues. Replace `extractPark` with an adapter for whatever the site actually serves before relying on it.

## The Cinematheque

### Observed

- `/films`, `/films/calendar`, and individual `/films/{year}/{slug}` pages are server-rendered.
- Individual film pages include screening-specific ticket links such as:

```text
https://tickets.thecinematheque.ca/websales/pages/ticketsearchcriteria.aspx
  ?evtinfo={numeric-event-id}~{venue-guid}&
```

- The observed venue GUID is stable within the inspected pages, while `evtinfo` changes by screening.
- No JSON-LD schedule payload or obvious first-party XHR schedule feed was observed on initial page load.

### Network-tab target

Start with the **Doc** and **Fetch/XHR** filters. Load `/films/calendar`, open one film, and click one screening only far enough to reach Vista Websales—do not add anything to a cart.

Filter with:

```text
websales OR evtinfo OR performance OR session OR event
```

Record the first read-only Vista request that resolves `evtinfo` into performance time, availability, and venue. Do not treat basket, customer, seat-hold, or payment endpoints as data sources.

### Decision gate

The first-party HTML is currently the safer source of truth for film metadata and showtime-to-ticket mapping. A Vista JSON endpoint is useful only if it is an unauthenticated read endpoint and materially improves status or schedule coverage. Keep the full existing Websales URL as the `ticket_url`; do not synthesize checkout URLs from guessed parameters.

## VIFF Centre

### Observed

- `/whats-on/` is paginated server-rendered WordPress HTML (`/whats-on/page/{n}/`).
- Cards already expose titles, series/tags, detail URLs, status text, and screening-specific booking links.
- Booking URLs follow `/whats-on/{film-slug}/book/{opaque-session-token}/`.
- The booking page is powered by `content.elevent.app/embedded-widget/elevent-widget.min.js` and initializes with an Elevent tenant key.
- A booking page renders the date, local time, venue, price, availability messaging, and add-to-cart UI.
- WordPress exposes a standard REST root at `https://viff.org/wp-json/`, but the public listings do not require it to render.

### Network-tab target

For listings, first test **Doc** requests for `/whats-on/page/2/` and `/whats-on-calendar/`. For booking detail, open one `/book/{token}/` page with **Fetch/XHR** selected and filter:

```text
elevent OR content.elevent.app OR api OR performance OR availability
```

Capture the first Elevent read request that uses the opaque session token. Expected useful fields are performance/session ID, start time, venue, price band, availability/status, and event title.

### Decision gate

Use VIFF’s own server-rendered listings as the default schedule source. Query Elevent only if it provides a stable unauthenticated read endpoint for availability or fields missing from the HTML. Never depend on cart, authentication, Stripe, or device-fingerprinting traffic.

## Hollywood Theatre

### Observed

- The site is Webflow CMS.
- Event cards are already present in rendered HTML and include date, title, event-detail link, CTA label, and a direct third-party ticket link.
- Ticket providers vary by event (for example Ticketmaster, Ticketweb, Eventbrite, Fever, Orange Tickets, or Gigpit).
- Pagination uses a Webflow/Finsweet query parameter such as `?8c848147_page=2`.
- Finsweet `cmsfilter`, `cmsload`, and `cmsnest` scripts are present; no dedicated theatre JSON API was observed.

### Network-tab target

Clear the log, click **See more Events**, and filter:

```text
8c848147_page OR cmsload OR webflow OR events
```

Determine whether Finsweet requests the next Webflow page as HTML or calls a JSON endpoint. Capture the request URL, response type, and whether the returned fragment includes direct ticket URLs.

### Decision gate

If the response is HTML, treat the stable paginated Webflow pages as the clean source; this is simpler and less brittle than selectors against the interactive homepage. Preserve each provider’s exact external ticket URL. Because Hollywood hosts concerts and comedy as well as film, ingest only the `film` category unless product scope explicitly expands.

## Payload acceptance checklist

A candidate source advances to Step 3 only if it passes all applicable checks:

- No login, cart, seat hold, payment, or customer data required
- Stable across a hard refresh and incognito session
- Has a stable event/performance identifier
- Carries an explicit timezone or can be safely interpreted as `America/Vancouver`
- Covers at least the currently published schedule horizon
- Supplies or can be deterministically joined to the exact external ticket URL
- Uses a request rate compatible with polite scheduled polling
- Has a documented HTML fallback and a last-known-good cache strategy

## Capture worksheet

For each venue, record one representative request:

```text
Venue:
Page/action that triggered it:
Request URL:
Method:
Query/body parameters:
Response Content-Type:
Authentication/nonce required:
Stable event ID field:
Title field:
Start/end field and timezone:
Ticket URL or ticket ID field:
Status/availability field:
Pagination/date-range mechanism:
Caching headers:
Redacted cURL saved:
Response sample saved:
```

These four captured responses—not assumptions about the sites—are the input contract for Step 3.
