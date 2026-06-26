# BAY Project

A Next.js app skeleton for the Leadership Retreat.

## Tech stack

- **[Next.js 16](https://nextjs.org/) (canary)** — App Router, with **Partial Prerendering (PPR)** enabled via the `cacheComponents` flag in `next.config.ts`
- **[React 19](https://react.dev/)** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com/)**
- **[shadcn/ui](https://ui.shadcn.com/)** (Radix base, Nova preset)
- **[TanStack Query](https://tanstack.com/query) (React Query)** — provider wired into the root layout

## Requirements

- **Node.js 20+** (developed on Node 24)
- **npm** (a `package-lock.json` is committed)

## Install dependencies

```bash
npm install
```

## Run the project

### Development

Starts the dev server with hot reload:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Production build

Build an optimized production bundle, then serve it:

```bash
npm run build
npm run start
```

The build log will print `Cache Components enabled`, confirming PPR is active.

## Other scripts

| Command         | What it does                      |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server (hot reload) |
| `npm run build` | Create a production build         |
| `npm run start` | Serve the production build        |
| `npm run lint`  | Run ESLint                        |

## Adding shadcn/ui components

```bash
npx shadcn@latest add button
```

## Project structure

```
src/
  app/
    layout.tsx      # Root layout — wraps the app in the React Query provider
    providers.tsx   # Client-side QueryClientProvider
    page.tsx        # Home page
    globals.css     # Tailwind + theme tokens
  lib/
    utils.ts        # shadcn `cn` helper
next.config.ts      # cacheComponents (PPR) enabled here
components.json      # shadcn/ui config
```

> **Note:** This project runs a Next.js **canary** release (PPR requires it). The `AGENTS.md` file documents canary-specific conventions — keep it as-is.
