# Bar Shop POS

This folder is an independent bar and liquor-shop POS based on the existing JL Racing POS workflow. It contains:

- `pos/`: Next.js admin POS
- `backend/`: Express API with Prisma and PostgreSQL

The inherited inventory workflow is used for bottles, cans, kegs, mixers, snacks, and other products. Product brands become drink brands, product categories become categories such as Beer, Spirits, Wine, Mixers, and Snacks, and suppliers are beverage suppliers.

## PostgreSQL setup

Use Node.js `18.17.0` or newer before installing either service. Node 20 LTS or newer is recommended.

Install PostgreSQL locally with Postgres.app or Homebrew, then create a dedicated database and user:

```bash
createdb bar_shop
createuser bar_shop_user --pwprompt
psql -d postgres -c 'ALTER DATABASE bar_shop OWNER TO bar_shop_user;'
```

Create `backend/.env` from `backend/.env.example`, set the password, and keep the database separate from JL Racing:

```env
DATABASE_URL="postgresql://bar_shop_user:YOUR_PASSWORD@localhost:5432/bar_shop?schema=public"
PORT=5010
JWT_SECRET="replace-with-a-long-random-secret"
CORS_ORIGIN="http://localhost:3010"
```

Initialize the schema and seed the first POS administrator:

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npx prisma db seed
npm run dev
```

The seeded development login is `manager@barshop.local` with password `BarShop@123`. Change it before using the system outside local development.

In another terminal:

```bash
cd pos
npm install
printf 'NEXT_PUBLIC_API_URL=http://localhost:5010\n' > .env.local
npm run dev -- --port 3010
```

Open http://localhost:3010.

## Daily bar workflow

1. Add product categories and brands under **Drinks & Products**.
2. Add bottles, cans, kegs, mixers, and snacks with quantity, cost, selling price, and low-stock threshold.
3. Use the product sale flow to record checkout, customer, payment method, and quantity.
4. Review **Sold Items**, invoices, receipts, vouchers, and the general ledger for end-of-day reconciliation.
