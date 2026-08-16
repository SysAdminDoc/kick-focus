# Blocked roadmap items

Items here require external state or an operator decision and are not active implementation work.

- P0 — Repeatable cold-load test under installed Tampermonkey and Violentmonkey on current Chrome/Edge and Firefox. Blocked because no manager installations, browser profiles, or configured test browsers are available in this checkout; automating installation would require external software/profile setup.
- P1 — Verify logged-in account, subscription, and moderation surfaces. Blocked because this workspace has no authenticated Kick session, and testing those controls requires an account owner to provide a logged-in browser context.
- P1 — Scrub stitched ad ranges from the HLS manifest. Blocked by the measured IVS WASM/blob-worker path: the manifest is not visible to the page realm, and worker injection into the opaque WASM pipeline is unverified and playback-critical. (2026-08-16: superseded for observability by R-09 — the IVS Web Player SDK emits first-party ad-break events, a read-only path that needs no worker injection. Manifest *scrubbing* stays blocked; ad-break *observation* moved to ROADMAP R-09.)
- P3 — Add an optional update manifest. Blocked until a publication channel and update-host trust decision are explicitly approved. (Tracked as ROADMAP R-24, operator-gated.)
- P3 — Evaluate an accessible first-run tour. Blocked until real-user feedback exists to guide the tour scope and timing.
