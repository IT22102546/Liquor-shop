/**
 * PM2 processes for the production server (run as the "deploy" user).
 *   bar-shop-api  → Express API on 127.0.0.1:5010 (behind Nginx at api.pos.kodearcs.tech)
 *   bar-shop-web  → Next.js app on 127.0.0.1:3001  (behind Nginx at pos.kodearcs.tech)
 * Started / reloaded by scripts/deploy.sh:  pm2 startOrReload ecosystem.config.cjs --update-env
 */
module.exports = {
  apps: [
    {
      name: "bar-shop-api",
      cwd: `${__dirname}/backend`,
      script: "dist/index.js",
      // Settings (PORT, DATABASE_URL, JWT_SECRET, SMTP_*…) come from backend/.env.
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      time: true,
    },
    {
      name: "bar-shop-web",
      cwd: `${__dirname}/pos`,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
