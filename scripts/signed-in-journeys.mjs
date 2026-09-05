/**
 * The journeys only a signed-in Kick account can reach.
 *
 * The automated gate runs logged out, deliberately: it needs no credentials, it
 * cannot damage an account, and it is safe to run on any machine. The cost is
 * that everything Kick renders only for a session was covered by a manual pass
 * whose findings lived in a person's head and, at best, in one line of README
 * prose. That is not evidence, and it is not repeatable.
 *
 * This is the matrix instead. Each entry names the route, why the route needs a
 * session, the selectors the build depends on there, what it reads, and the
 * mutation claim. `scripts/verify-extension.mjs` reads it: with no session it
 * emits one skip per journey naming exactly what a signed-in run would cover,
 * and with a session it opens each route and asserts the expectations resolve.
 * `scripts/release-checklist.mjs` prints it, so a release states what was and
 * was not exercised rather than implying everything was.
 *
 * Two rules hold for every entry, and the tests enforce both:
 *
 *  1. **Read-only.** No journey here writes anything to the account. The only
 *     writes in the whole build are the follow request behind the click-to-save
 *     emote gesture and the unfollow that undoes it, neither of which is one of
 *     these journeys, and `scripts/check.mjs` proves there is no third.
 *  2. **Nothing personal is recorded.** Expectations are selectors and route
 *     shapes. No screenshots, no fixture text, no balances, no display names, no
 *     chat, and no session data — a matrix is a file that gets committed and
 *     read for years, and it must be safe for a stranger to read.
 */

export const SIGNED_IN_JOURNEYS = Object.freeze([
  Object.freeze({
    id: 'account-menu',
    title: 'Account menu',
    route: '/',
    // Why a session is needed, phrased so the skip line is actionable rather
    // than a shrug. `scripts/check.mjs` rejects a skip reason that is a bare
    // noun, and these become skip reasons.
    why: 'the header shows a sign-in button to anonymous visitors and the account menu only to a session',
    expects: Object.freeze(['[data-testid="account-menu"], [aria-haspopup="menu"][aria-label*="account" i]']),
    reads: Object.freeze(['DOM: the header control and its menu items']),
    mutates: false,
  }),
  Object.freeze({
    id: 'daily-reward',
    title: 'Daily Reward dialog',
    route: '/',
    why: 'the reward control is rendered for a session only, and its action button is disabled until the account has watched enough',
    expects: Object.freeze(['[role="dialog"] button', '[data-testid="daily-reward"], [aria-label*="reward" i]']),
    // The claim itself lives in Kick's own bundle. This build drives the dialog
    // button and never replays the request, so a disabled button is Kick
    // refusing and there is no way to claim something the account has not
    // earned. Auto-claim is a user setting and off by default.
    reads: Object.freeze(['DOM: the reward control, the dialog, and the enabled state of its action']),
    mutates: false,
  }),
  Object.freeze({
    id: 'profile',
    title: 'Profile settings',
    route: '/settings/profile',
    why: 'every /settings/ route redirects an anonymous visitor to the login page',
    expects: Object.freeze(['a[href^="/settings/"]', '[aria-current="page"]']),
    reads: Object.freeze(['DOM: the settings navigation links and the current pathname']),
    mutates: false,
  }),
  Object.freeze({
    id: 'preferences',
    title: 'Preferences settings',
    route: '/settings/preferences',
    why: 'every /settings/ route redirects an anonymous visitor to the login page',
    expects: Object.freeze(['a[href^="/settings/"]', 'input, select, button']),
    reads: Object.freeze(['DOM: form controls, so this build can style them without changing a value']),
    mutates: false,
  }),
  Object.freeze({
    id: 'notifications',
    title: 'Notifications',
    route: '/settings/notifications',
    why: 'the notification list is account state and is not served to an anonymous visitor',
    expects: Object.freeze(['a[href^="/settings/"]']),
    reads: Object.freeze(['DOM: the list container, for layout only; no notification text is read or stored']),
    mutates: false,
  }),
  Object.freeze({
    id: 'drops',
    title: 'Drops and rewards',
    route: '/drops/campaigns',
    why: 'campaigns are listed per account; logged out the page renders its empty state and nothing else',
    expects: Object.freeze(['[data-testid="sidebar-drops"]', '[data-testid="empty-state-root"], main a[href^="/drops/"]']),
    reads: Object.freeze(['DOM: the tab links and the empty state']),
    mutates: false,
  }),
  Object.freeze({
    id: 'collectibles',
    title: 'Collectibles',
    route: '/collectibles',
    why: 'the collectible inventory is account state; the gamification read answers 401 without a session',
    expects: Object.freeze(['main button', 'main img']),
    reads: Object.freeze(['GET https://web.kick.com/api/v1/gamification/collectibles', 'DOM: collectible tiles, by their button and image semantics']),
    mutates: false,
  }),
  Object.freeze({
    id: 'channel-points',
    title: 'Channel points',
    route: '/xqc',
    why: 'the points counter is per-account and per-channel, so a logged-out channel page renders no value node at all and the Viewer card can only report that it has not been read',
    expects: Object.freeze(['[data-testid="channel-points-value"]']),
    reads: Object.freeze(['DOM: the channel points value node, and the unrounded figure in its title attribute']),
    // Points are a per-channel feature the broadcaster can leave off, so a
    // signed-in run against a channel that does not use them is a correct
    // build with nothing to see. Absent is reported, not failed.
    absentWhy: 'this channel does not run channel points for this account, so there is no value node to read',
    mutates: false,
  }),
  Object.freeze({
    id: 'level',
    title: 'Kick level',
    route: '/',
    // Deliberately narrower than "read the account's level". The build has no
    // endpoint for it: the figure is parsed out of the reward dialog's own
    // text, so it is readable only while that dialog is open, and the Viewer
    // card says "not read yet" the rest of the time. A journey that implied a
    // standalone read would describe a feature that does not exist.
    why: 'the level figure exists only inside the daily reward dialog, which Kick renders for a session and not for an anonymous visitor, so nothing offers the number on a logged-out page',
    // Only the trigger. The dialog this build reads is the one the trigger's
    // own `aria-controls` names, verified by its labelled heading and marked
    // by this build when it opened it — none of which a selector list can
    // state, and asserting a bare `[role="dialog"]` would pass on Kick's
    // unrelated privacy dialog instead.
    expects: Object.freeze(['button[aria-label="Claim Your Daily Reward"]']),
    reads: Object.freeze(['DOM: the reward dialog named by the trigger aria-controls, parsed for the level and streak figures']),
    // The trigger is gone once the day's reward has been claimed, so a run
    // after claiming is a correct build with nothing to assert.
    absentWhy: 'the daily reward for this account has already been claimed, so Kick renders no reward trigger to open',
    mutates: false,
  }),
  Object.freeze({
    id: 'emote-catalog',
    title: 'Authenticated emote catalog',
    route: '/xqc',
    why: 'the account-wide catalog comes from a read that answers only for a session; logged out it yields nothing and the view says so instead of showing an empty inventory',
    expects: Object.freeze(['#channel-chatroom', '[data-testid="chatroom-messages"], #chatroom-messages']),
    reads: Object.freeze(['GET https://kick.com/emotes/{channel}', 'DOM: the native emote picker when it is open']),
    mutates: false,
  }),
]);

/** The only writes in the build, named here so the read-only claim above is falsifiable. */
export const ONLY_ACCOUNT_WRITE = Object.freeze({
  fn: 'mutateKickChannelFollow',
  endpoint: 'followChannel',
  gesture: 'the click-to-save gesture on an emote Kick itself marks follow-gated, and the undo that reverses it',
  methods: Object.freeze(['POST', 'DELETE']),
  // Empty on purpose, and asserted: no journey in the matrix reaches this.
  journeys: Object.freeze([]),
});
