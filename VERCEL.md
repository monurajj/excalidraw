# Deploying CM whiteboard (production app) on Vercel

The **real web app** is the Vite app in **`excalidraw-app/`** (full whiteboard UI).  
The folder **`examples/with-nextjs/`** is only a **developer sample** (demo buttons, “App Router”, etc.). It must **not** be what you deploy for production.

## Required Vercel project settings

| Setting | Value |
|--------|--------|
| **Root Directory** | *(empty)* — repository root, **not** `examples/with-nextjs` |
| **Framework Preset** | Other (or leave auto; root `vercel.json` sets `framework: null`) |
| **Install Command** | `yarn install` |
| **Build Command** | `yarn build` |
| **Output Directory** | `excalidraw-app/build` |

These match root **`vercel.json`**. If the dashboard overrides them, align with the table above.

## Verify locally (same as Vercel)

```bash
yarn install
yarn build
```

Open `excalidraw-app/build/index.html` via a static server, or `yarn start:production` from the repo root after build.

## Wrong site?

If you see **“Excalidraw with Nextjs Example”**, **“App Router”**, or rows of demo checkboxes, the deployment is using the **Next.js example**. Create a new Vercel project (or change **Root Directory** to the repo root) and redeploy.
