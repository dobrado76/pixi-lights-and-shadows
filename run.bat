npm install
npm i -D cross-env
npm run build
npm run dev


rem modify package.json for this:
rem
rem "scripts": {
rem  "dev": "cross-env NODE_ENV=development tsx server/index.ts",
rem  "start": "cross-env NODE_ENV=production node dist/index.js",
rem  "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
rem  "check": "tsc",
rem  "db:push": "drizzle-kit push"
rem },