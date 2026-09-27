# Mola

A portrait 3D café tycoon for Android. Serve customers, hire staff, add seating and grow one café into a small chain. English and Turkish.

Built with TypeScript, Three.js, Vite and Capacitor.

## Run it

Requires Node 22+.

```sh
npm ci
npm run dev      # play in the browser
npm test         # game rules, saves and localization
npm run build    # production web bundle
```

Android (debug build, uses Google's sample ad units):

```sh
npm run android:sync
cd android && ./gradlew assembleDebug
```

## Configuration

The files below hold example values. Replace them with your own before a release build:

| File | Contents |
| --- | --- |
| `admob.config.json` | AdMob app and ad unit IDs (Google sample IDs by default) |
| `billing.config.json` | Purchase verification URLs and receipt public key |
| `play-games.config.json` | Google Play Games project and leaderboard IDs |
| `capacitor.config.ts`, `android/app/build.gradle` | App ID (`com.example.mola`) |

Release builds refuse to run with sample ads, empty billing settings or missing signing credentials. Never commit keystores, service-account files or private keys.

`server/billing` contains the purchase verification service. See its README for required environment variables.

## Layout

- `src/game` — simulation, economy, saves
- `src/view` — Three.js scene and models
- `src/platform` — ads, billing, audio, native bridges
- `android` — Capacitor Android project
- `server/billing` — Google Play purchase verification
- `tests` — Vitest suites

## License

Code is licensed under [GPL-3.0](LICENSE). Third-party assets keep their own licenses. See `assets/PROVENANCE.md` and `public/third-party-notices.txt`.

The "Mola" name and logo are not licensed for use in your own published apps. If you ship a fork, give it a different name and icon.
