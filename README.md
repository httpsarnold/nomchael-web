# Nomchael Web

Next.js frontend for Nomchael Construction ERP.

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Web: `http://localhost:3000`

Set `NEXT_PUBLIC_API_URL` to the API base (no `/api` suffix), e.g. `http://localhost:3001`.

## Railway

1. New project from this repo
2. Set `NEXT_PUBLIC_API_URL` to the public API URL (e.g. `https://nomchael-api.up.railway.app`)
3. Build: `npm run build`
4. Start: `npm run start`
5. Root directory: repo root
