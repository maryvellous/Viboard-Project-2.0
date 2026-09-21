# Diaspro Viboard brand assets

- `viboard-logo.svg` — primary Viboard mark. Used in onboarding/startup and as the source for native application icons.
- `diaspro-logo.tsx` lives in the brand component folder and remains the compact Diaspro mark used in the sidebar.
- The web favicon remains at `packages/app/public/favicon.svg`.

Run `npm run icons -w @desk/app` to regenerate the Tauri icon set in
`packages/app/src-tauri/icons/` from `viboard-logo.svg`.
