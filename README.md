# TrendMart Sales Analytics System

A web-based sales and stock management system for a multi-store retail group. It records sales and updates stock as each sale happens, gives managers store-by-store reporting and decision support, and protects data with role-based access control, optional multi-factor authentication and an audit trail.

Built as the final project for module NPRJ740 (Software Development Project).

## Features

**Sales and stock**
- Record a sale with stock validation and an all-or-nothing stock update. Row-level locking means two people selling the last unit at the same moment can never oversell it.
- Cancel a same-day transaction and restore its stock automatically.
- Search and filter transactions by product text, category, store and date range, with the active filters shown and cleared in one click.
- Low-stock alerts on the Products screen and on a Dashboard panel that refreshes every minute.

**Reports and analytics**
- Daily Sales, Best-Selling Products and Store Performance reports, each exportable as CSV or PDF.
- A Dashboard with today's and all-time revenue, a 7-day chart, top products and today's revenue per store.
- Advanced analytics: 30-day trend, week-on-week change, revenue by category, a moving-average projection and estimated profit margins.
- Reorder recommendations: estimated days until stockout for every product, a Reorder now / Reorder soon / Healthy status and a suggested reorder quantity.

**Security and administration**
- Three roles, enforced by the server on every request and not only in the interface.
- Passwords stored as bcrypt hashes, and an account lockout for 15 minutes after 5 failed logins.
- Optional time-based one-time-passcode (TOTP) multi-factor authentication for Managers and System Administrators.
- An audit log of login attempts and authenticated requests, with an automatic monthly clean-up (failed logins after 90 days, everything else after 3 years).
- Users, products and stores are deactivated, never deleted, so history stays intact.

## Roles

| Role | Can do | Cannot do |
|---|---|---|
| **System Administrator** | Create user accounts, reset passwords (which also unlocks an account), deactivate and reactivate users, enable MFA | See any business data: products, stores, sales, reports or analytics |
| **Manager** | Everything business-related: Dashboard, Advanced Analytics, reorder recommendations, products, stores, all reports and exports, sales and cancellations for any store, enable MFA | Manage user accounts |
| **Sales Staff** | Record sales for their assigned store, cancel their own same-day sales, view products, search their store's transactions, run and export the Daily Sales report for their store | Change products or stores, see other stores' data, or open analytics and the other reports |

## Tech stack

| Layer | Technology |
|---|---|
| Front end | React, Vite, React Router, Axios, jsPDF and jspdf-autotable for PDF export |
| Back end | Node.js, Express, mysql2, jsonwebtoken, bcryptjs, speakeasy and qrcode (MFA), node-cron |
| Database | MySQL 8 |
| Testing | Jest and Supertest |

## Getting started

### Prerequisites

- Node.js 22.12 or newer (developed on Node 24)
- MySQL Server 8.0.16 or newer, and a MySQL user that is allowed to create databases
- Git

### 1. Get the code

```bash
git clone https://github.com/BlueHaneul/trendmart.git
cd trendmart
```

### 2. Configure and install the back end

```bash
cd trendmart-backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `.env` and set at least `DB_PASSWORD` (your MySQL password) and `JWT_SECRET` (a long random string). To generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Create the database

```bash
npm run db:setup
```

This creates the database named in `DB_NAME`, builds every table from `database/schema.sql`, and loads demo data: 5 stores, 5 user accounts, 12 products and 240 sample sales across all stores. It refuses to touch a database that already has tables. To rebuild one from scratch (this destroys everything in it): `npm run db:setup -- --reset --yes`.

### 4. Start the back end

```bash
npm run dev
```

You should see `MySQL pool connected.` and `Server running on port 5000`.

### 5. Start the front end

In a second terminal:

```bash
cd trendmart-system
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with one of the demo accounts below.

## Demo accounts

Created by `npm run db:setup`. These passwords are for demonstration only and must be changed before any real use.

| Username | Password | Role | Lands on |
|---|---|---|---|
| `sysadmin` | `sysadmin123` | System Administrator | User Management |
| `admin` | `admin123` | Manager | Dashboard |
| `staff` | `staff123` | Sales Staff (Kimberley) | Sales |
| `staff2` | `staff123` | Sales Staff (Upington) | Sales |
| `staff3` | `staff123` | Sales Staff (Bloemfontein) | Sales |

To try MFA, sign in as `admin` or `sysadmin`, open **Security**, and scan the QR code (or enter the setup key) in an authenticator app such as Google Authenticator, Aegis or FreeOTP.

## Configuration

Back end (`trendmart-backend/.env`, copied from `.env.example`):

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Port the API listens on | `5000` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | your password |
| `DB_NAME` | Database name | `trendmart_db` |
| `JWT_SECRET` | Secret used to sign login tokens | a long random string |
| `JWT_EXPIRES_IN` | Login token lifetime | `8h` |
| `MFA_ISSUER` | Name shown in authenticator apps | `TrendMartAnalytics` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGINS` | Comma-separated browser addresses allowed to call the API | `http://localhost:5173` |

Front end (`trendmart-system/.env`, optional): `VITE_API_URL` overrides the API address. Leave it unset and the app calls the API on whichever host served the page, which works on `localhost` and over a local network.

## Running the tests

```bash
cd trendmart-backend
npm test
```

The suite has 36 automated tests (Jest and Supertest). They send real requests to the Express app and check the database afterwards, so they run against the database in `DB_NAME`. They create and remove their own test records, but they rely on the demo accounts, so run them against a database built by `npm run db:setup`.

To run them against a separate, freshly built database and leave your own data untouched:

```bash
# macOS / Linux / Git Bash
DB_NAME=trendmart_verify npm run db:setup && DB_NAME=trendmart_verify npm test

# Windows PowerShell
$env:DB_NAME = "trendmart_verify"; npm run db:setup; npm test; Remove-Item Env:DB_NAME
```

Drop the extra database afterwards with `DROP DATABASE trendmart_verify;`.

### Performance check

With the back end running:

```bash
npm run perf                    # measure against the current data
npm run perf -- --seed 5000     # add 5000 synthetic transactions, measure, then remove them
npm run perf -- --cleanup       # remove synthetic data left behind by an interrupted run
```

It simulates 10 concurrent users and compares the 95th percentile response times with the performance targets. Results are saved to `scripts/performance-results.txt`.

## Using it from another device on the same network

1. Find your computer's IPv4 address (`ipconfig` on Windows, `ip addr` or `ifconfig` elsewhere), for example `192.168.1.42`.
2. In `trendmart-backend/.env`, add that address to `ALLOWED_ORIGINS`, then restart the back end:
   ```
   ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.42:5173
   ```
3. Make sure ports `5000` and `5173` are allowed through the firewall, and that the network is not a guest network that isolates devices.
4. On the other device, open `http://192.168.1.42:5173`.

The Vite dev server already listens on the network (`server.host` in `vite.config.js`), and the front end finds the API from the address it was loaded from.

## Project structure

```
trendmart/
├── trendmart-backend/
│   ├── config/db.js               MySQL connection pool
│   ├── database/schema.sql        Every table, constraint and index
│   ├── jobs/retention.js          Monthly audit-log clean-up
│   ├── middleware/
│   │   ├── auth.js                Token check and role guards
│   │   └── audit.js               Audit logging helper
│   ├── routes/                    auth, products, stores, sales, reports
│   ├── scripts/
│   │   ├── setup-database.js      One-command database setup and demo data
│   │   └── performance-check.js   Concurrent-load timing script
│   ├── tests/                     Jest and Supertest tests
│   └── server.js
└── trendmart-system/
    └── src/
        ├── api/axios.js           API client
        ├── components/            Shared interface components
        ├── context/AuthContext.jsx
        ├── pages/                 One file per screen
        ├── utils/                 CSV and PDF export
        └── App.jsx                Routing and layout
```

## API overview

All routes are under `/api`. Every route except login and health needs a bearer token, and each route enforces its roles on the server.

| Area | Endpoints | Roles |
|---|---|---|
| Health | `GET /health` | Anyone |
| Login and MFA | `POST /auth/login`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify` | Login: anyone. MFA: signed-in users |
| User management | `GET /auth/users`, `POST /auth/register`, `PUT /auth/users/:id/password`, `DELETE /auth/users/:id`, `PATCH /auth/users/:id/activate`, `GET /auth/store-options` | System Administrator |
| Products | `GET /products`, `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `PATCH /products/:id/activate` | Read: Manager, Staff. Write: Manager |
| Stores | `GET /stores`, `GET /stores/:id`, `POST /stores`, `PUT /stores/:id`, `DELETE /stores/:id`, `PATCH /stores/:id/activate` | Read: Manager, Staff. Write: Manager |
| Sales | `GET /sales` (filters: `product`, `category`, `store_id`, `start_date`, `end_date`, `date`, `status`), `POST /sales`, `PUT /sales/:id/cancel` | Manager, Staff (Staff limited to their store) |
| Reports | `GET /reports/daily` | Manager, Staff (Staff: own store) |
| | `GET /reports/best-sellers`, `/store-performance`, `/dashboard`, `/analytics`, `/reorder-recommendations` | Manager |

`DELETE` on a product, store or user deactivates it. Nothing is hard-deleted.

## Scripts

| Where | Command | What it does |
|---|---|---|
| `trendmart-backend` | `npm run dev` | Start the API with auto-restart (nodemon) |
| | `npm start` | Start the API |
| | `npm test` | Run the automated tests |
| | `npm run perf` | Run the performance check |
| | `npm run db:setup` | Create the database, tables and demo data |
| `trendmart-system` | `npm run dev` | Start the front end on port 5173 |
| | `npm run build` | Build the front end for production |
| | `npm run lint` | Run ESLint |

## Troubleshooting

| Problem | Fix |
|---|---|
| `Database "..." already has tables` | `db:setup` only builds an empty database. Use `--reset --yes` to rebuild it (destroys its data), or set a different `DB_NAME`. |
| The browser shows a network or CORS error | Add the exact address in the browser's address bar to `ALLOWED_ORIGINS` and restart the back end. |
| `Cannot connect to MySQL` | Check that the MySQL service is running and that `DB_HOST`, `DB_USER` and `DB_PASSWORD` in `.env` are correct. |
| Port 5000 or 5173 is already in use | Stop the other program, or change `PORT` in `.env`. |
| An account is locked after 5 failed logins | Wait 15 minutes, or sign in as `sysadmin` and reset that user's password, which unlocks it. |

## Security notes

- The demo accounts have simple, published passwords. Change them before any real use.
- The system runs over plain HTTP, so passwords and tokens are not encrypted in transit. Use it only on a trusted network, and put it behind HTTPS in any real deployment.
- Real secrets (`JWT_SECRET`, database password) live in `.env`, which is excluded from git. Only `.env.example`, with placeholder values, is committed.
- A login token stays valid for its full lifetime (8 hours by default), even if the account is deactivated in the meantime.

## Known limitations

- Stock is one figure per product for the whole business, not per store.
- Profit margins assume a fixed 55% cost of goods because cost prices are not recorded. The sales projection and reorder quantities are simple moving-average estimates, not statistical forecasts.
- Each sale records one product. Multi-item baskets and partial returns are not supported.
- The monthly audit clean-up runs only while the server is running.
