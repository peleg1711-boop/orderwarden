# OrderGuard
Etsy order tracking and refund prevention tool.

## Local development

```bash
npm install
```

Create a `.env` file and set `DATABASE_URL` for PostgreSQL:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/orderguard"
```

Run Prisma migrations and generate the client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Start the API:

```bash
npm run dev
```

The API runs on `http://localhost:3000` by default.

## Example request

```bash
curl -X POST http://localhost:3000/api/orders/check \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORDER-123","trackingNumber":"1Z999AA10123456784"}'
```
