# Marketplace Feature Plan — closing the competitor gap

Derived from the gap analysis vs Foodomaa/FoodStorm/BakeSmart (multi-vendor +
custom cake), Shef/Foodnome (homemade-food marketplaces) and Etsy (buyer↔seller).
Each phase is independently shippable and held to the repo's bar: entity +
reversible migration, NestJS module/controller/service, class-validator DTOs,
JWT/business-jwt guards, **unit + e2e tests**, verified against live
Postgres/Redis, committed + pushed.

Conventions (every phase):
- Register new entities in `src/common/typeorm.config.ts` `entities[]` **and** the
  owning module's `TypeOrmModule.forFeature`.
- Customer routes: `AuthGuard('jwt')` + `req.user.userId`. Seller routes:
  `AuthGuard('business-jwt')` + `req.user.businessId`. Object-level checks via
  `assertOwnership`.
- One migration per phase (so the prod `migrationsRun` path stays correct);
  `synchronize` covers dev/e2e.

---

## Phase 1 — Cart  (foundation: checkout, abandoned-cart, targeted offers)
- `Cart` (1:1 user) + `CartItem` (product, quantity). One active cart per user.
- `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`,
  `DELETE /cart` (clear). Server recomputes line/cart totals from live prices.
- Single-business guard mirrors checkout (items must share a business).
- `POST /orders/from-cart` → checkout the active cart, then clear it.
- Tests: add/update/remove/clear, cross-business rejection, totals; e2e add→checkout.

## Phase 2 — Address book
- `Address` (N:1 user): label, recipient, line1/line2, city, postcode, country,
  phone, isDefault. CRUD under `/addresses`; one default enforced.
- `Order.deliveryAddressId` (keep legacy string), `Order.contactPhone`,
  `Order.giftMessage`. Checkout can take `addressId`.
- Tests: CRUD, single-default invariant, ownership; e2e create→checkout-with-address.

## Phase 3 — Seller storefront + ratings
- `Business`: `slug`, `description`, `logoUrl`, `bannerUrl`, `rating`,
  `reviewCount`, business hours (jsonb), service area. Public
  `GET /shops/:slug` (profile + active catalog + aggregate rating) and
  `GET /shops` (browse).
- Recompute `Business.rating`/`reviewCount` when a product review changes
  (seller-level rating = mean across the seller's product reviews).
- Tests: slug generation/uniqueness, rating recompute; e2e public storefront.

## Phase 4 — Order lifecycle + notifications
- Expand `OrderStatus`: PENDING→CONFIRMED→PREPARING→READY→OUT_FOR_DELIVERY→
  DELIVERED (+ CANCELLED). Enforce legal transitions; seller drives forward,
  customer may cancel only pre-PREPARING.
- `Notification` (N:1 user): type, title, body, data(jsonb), readAt. Feed
  `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`.
- On each status change: enqueue an email (BullMQ) **and** write an in-app
  notification (best-effort). 
- Tests: transition matrix (legal/illegal), notification on transition; e2e flow.

## Phase 5 — Reviews v2
- `Review`: `verifiedPurchase` (set true only if the user has a DELIVERED order
  with that product), `sellerReply` + `sellerRepliedAt`, `images` (jsonb).
- `POST /products/:id/reviews` computes verifiedPurchase; one review per
  user+product. `POST /products/:id/reviews/:reviewId/reply` (business-jwt, owner).
- Tests: verified-purchase logic, one-per-user, seller reply ownership; e2e.

## Phase 6 — Wishlist / favorites
- `Favorite` (user, product) and `ShopFollow` (user, business). Toggle endpoints
  `POST/DELETE /favorites/products/:id`, `/favorites/shops/:id`; `GET /favorites`.
- `Product.favoriteCount` maintained.
- Tests: toggle idempotency, list, count; e2e.

## Phase 7 — Delivery-partner role + assignment
- `Driver` entity + auth (register/login, JWT 'driver'). Seller/admin assign a
  driver to a READY order; driver lists assigned orders and advances
  OUT_FOR_DELIVERY→DELIVERED.
- `Order.driverId`. Tests: assignment, driver-only transitions, ownership; e2e.

## Phase 8 — Custom-order deposit + buyer↔seller messaging
- Deposit: on quote acceptance, create a Stripe PaymentIntent for
  `depositAmount`; mark the request DEPOSIT_PAID on webhook.
- `Message` (thread keyed by order or custom-order, sender role, body). Send/list
  within a conversation, both parties only. Tests: deposit intent, message
  authz; e2e thread.

## Phase 9 — Fulfillment types + tips
- `Order.fulfillmentType` (PICKUP | DELIVERY | SHIPPING), `Order.tipAmount`;
  business hours / pickup option on the shop. Checkout accepts type + tip; totals
  include tip, delivery fee waived for PICKUP. Tests + e2e.

---

## Verification gate (after every phase, and a final full pass)
`npm run build` · `npm test` · `npm run test:e2e` (live PG+Redis) · check-only
lint on changed files · migration applies in the prod chain on a fresh DB. Update
this file's checkboxes and the OpenAPI/Swagger surface as endpoints land.

Status: ✅ P1 ✅ P2 ✅ P3 ✅ P4 ✅ P5 ✅ P6 ✅ P7 ✅ P8 ✅ P9
