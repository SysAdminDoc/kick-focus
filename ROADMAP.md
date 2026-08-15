# Roadmap

Updated: **2026-08-15**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Authenticated companion journey at both desktop viewports.** Load the unpacked extension in a throwaway profile that the user signs into directly, then repeat Home → Browse → Following → Drops → Search → Channel/chat at 1440×900 and 1920×1080. The isolated in-app browser supplied authenticated recon, while the extension proof used a separate logged-out profile; session data must never be exported between them.
2. **Worker-level stitched-ad observability.** Prototype a bounded `Worker`-constructor wrapper around the IVS worker and record only manifest/ad-signifier counts. Ship a mitigation only if it can separate ad media without replaying private endpoints, breaking playback, or proxying traffic. The current page-realm fetch/XHR hooks cannot see the worker-owned HLS manifest.
3. **Automated Kick DOM drift snapshots.** Add a maintainer-only reducer that turns fresh MHTML/live captures into small, sanitized fixtures and fails when stable probes disappear on Home, Browse, Following, Drops, Search, Category, Channel, or the open sticker picker. Keep raw captures ignored.
4. **Live Firefox companion proof.** Exercise the generated Manifest V2 package in a disposable Firefox profile, proving `webRequestBlocking`, page/bridge handshake, popup state, and current Kick DOM behavior. Firefox requires target and initiator host access for this API, so document the `<all_urls>` warning alongside the Kick-initiator runtime guard.
5. **Userscript-manager cold-start matrix.** Verify current Tampermonkey and Violentmonkey injection timing, storage/export behavior, SPA navigation, and ad-defense diagnostics in isolated profiles. Manager-specific grants cannot be considered live-verified by the direct fixture bundle.

## Explicitly deferred

- Mobile layout or mobile claims
- Remote analytics or telemetry
- Account automation, moderation writes, or bypassing authentication or sticker/subscription entitlements
- Proxy services, replay of private endpoints, or remote executable code
- Publishing to a userscript catalog or extension store without explicit approval
