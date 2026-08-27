# calendar-core

Pure TypeScript helpers for turning media history into calendar events.

- Canonical `CalEvent` type
- RFC 5545 ICS emit
- Trakt JSON → events (calendar + watch history)
- Netflix CSV/JSON viewing-activity parse
- Google Calendar API body + insert helpers

No DOM. Inject `fetch` for HTTP. Used by `apps/calendar-sync`; other apps can import `eventsToIcs` or the mappers directly.
