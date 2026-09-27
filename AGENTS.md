# Mola — agent and contributor guide

Mola is a portrait 3D café tycoon for Android: TypeScript, Three.js, Vite and Capacitor. It is a shipped game with real player saves. Extend what exists; do not rewrite it, build a demo from scratch, or swap the engine or stack.

## Where things live

- `src/game/config.ts` — tuning values, districts, menu and staff catalog
- `src/game/sim.ts` — the authoritative fixed-tick simulation. Every purchase or upgrade changes the simulation, never only the renderer.
- `src/game/save.ts` — versioned save validation and migration
- `src/game/i18n.ts` — English and Turkish text
- `src/view` — Three.js scene, models, materials, icons
- `src/platform` — ads, billing, Play Games, audio, native bridges
- `src/main.ts` — UI, input and app lifecycle
- `android` — Capacitor Android project and native plugins
- `server/billing` — Google Play purchase verification service
- `tests` — Vitest suites

## Commands

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:billing-server
node scripts/economy.mjs     # 30-minute progression simulation
```

## Working with the maintainer

- Be short, clear and plain. Make technical decisions yourself and give the reason.
- Do the authorized work and verify it. Do not stop at "I can do this" or a long plan.
- Do not ask for approval on routine, reversible steps. Ask only when something involves new cost, a personal or legal declaration, data loss or missing permission, and say why.
- No unrequested features, refactors, scope growth or alternative technologies. Finish the requested work first.
- In progress updates, say what changed and what remains. Do not leave the maintainer without an update for long stretches.
- Keep the final report short: what changed, how it was verified, open issues. Never present untested or broken work as done.

## Product approach

Own the whole player experience, from first launch to long-term growth, from save safety to store purchases.

- Priority order: **satisfying gameplay and growth → clear usability → strong, consistent visuals → reliable technical base → monetization**. Monetization must never force a paywall on core progression.
- Judge a request by its purpose. "Raise the customer limit" means "make the café feel busy and fun to manage", not "show a bigger number". Consider arrival rate, seating time, queue space, service and staff capacity together.
- Queues, dirt, stock shortages, low ratings, wages and capacity limits are content, not bugs, when the player can see the cause, has meaningful choices and feels the effect of investing. Separate real bugs from designed bottlenecks.
- Automation must not leave the player idle. As staff take over tasks, the player's focus should move from serving to capacity, menu, quality, staff and branch decisions.
- Show investment in the scene: new seating, filling tables, staff actually working, visible production and cleaning. A numeric bonus alone is not done.
- Watch system effects: more customers means more income, dirt, stock use, wage pressure and rating pressure. Do not fix one metric by breaking the loop.
- Use existing evidence; do not redo known work. Take the smallest meaningful measurement or experiment, then decide, implement and check.

## Code and comments

- Read the relevant code, current behavior and these instructions before changing anything. Use `rg` / `rg --files` to search.
- Fix root causes. Do not tweak a counter, text or limit and assume the game feel is fixed.
- Keep the architecture and local style. Small, consistent, readable changes. No needless layers, dependencies, abstractions or reformatting. Do not touch unrelated files or rewrite working code.
- Preserve save compatibility, EN/TR text, touch input and Android behavior in every related change. A new save field needs a safe default for older versions and a migration test.
- Do not show technical details in the UI. Buttons and menus should say what the player will do.
- Comment only what the code cannot say: decision reasons, business rules, SDK constraints, sensitive save and payment behavior. No long comment blocks, banners, changelogs or work reports in code.
- Do not delete useful existing comments, license notices or tool-required annotations.

## Git

- Check status and diffs. Never delete, claim or revert someone else's changes.
- No destructive cleanup or history rewrites. Commit only related, reviewed files; never bulk-add build outputs, backups or secrets.

## Testing

- Run the tests related to your change first. Tests must check behavior and real risk, not mirror the implementation or pad the count.
- Once relevant tests pass, do not rerun the same checks without a new change or concrete risk.
- Economy, save, billing, ad and account lifecycle changes need meaningful regression tests. A simple text fix does not need a full replay.
- Actually look at visual changes: small portrait screens, touch targets and large system fonts. A passing build is not a visual check.
- Browser runs do not prove Android, AdMob, Play Billing or Play Games behavior. Label sample data and sample-ad tests as such.
- Never fabricate Google accounts, scores, purchase results or evidence. Unknown is not `true`.
- "Build passed", "tested on device", "uploaded to the store" and "publicly released" are different stages. Do not use one for another.

## Protect the environment

- Never delete a player's save, uninstall the app or inject gold or save data for testing. A debug APK is not signed like the release build; check the save-preservation path before updating an installed app.
- If the maintainer is using a phone or browser, do not click in it at the same time. One agent controls one device or browser session.
- Do not kill processes or servers you did not start.
- Never commit or paste keystores, service-account files, private keys, tokens, email lists, player saves or purchase tokens. The config files in the repo root hold example values only. Never regenerate a live receipt signing key.
- Before any real payment, confirm a free license-testing method exists. Do not create new paid infrastructure.
- When resuming an interrupted store console form, read the current screen first. Do not create the same product, listing or cloud project twice.

## Parallel agents

When sub-agents are available and allowed:

- Delegate only independent, well-bounded, useful work. Do not multiply agents for its own sake. If one task's output is another's input, finish the input first.
- Typical split: a **lead** that owns the goal, integration and critical changes while doing useful work itself; a **gameplay/economy** agent with calculations and test evidence; a **visual/UX playtest** agent in an isolated browser context; a **platform** agent owning one Android, server or store area and the only one on a real device.
- Each assignment states: the goal and success criteria, what is out of scope, which files it may change or only inspect, which devices or sessions it may use, the expected result (findings, changes, tests, open questions), and what the lead does meanwhile.
- Two agents never edit the same file or drive the same browser or phone. Pick one owner or hand off in order.
- Review and integrate agent results; do not accept them blindly or paste their reports into code. Final quality responsibility stays with the lead.
- Blocking behavior and data or payment issues first, core growth loop and readability next, cosmetics last. When told to stop, stop all agents and write the real state down.

## License

GPL-3.0. Third-party assets keep their own licenses; record new assets in `assets/PROVENANCE.md` and `public/third-party-notices.txt`. The "Mola" name and logo are not licensed for forks.
