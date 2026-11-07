# Yatharth: deployment

Lab report delivery portal for Company A, Vijayawada.

- GitHub: https://github.com/shirii8/yatharth_Labs
- Live app: https://yatharth-labs-beryl.vercel.app (Vercel, Mumbai; database on Supabase, Mumbai)

All data in the app is synthetic. SMS is simulated, as the brief asks.

## 1. Run it locally

You need Node.js 20 or newer (22 tested) and Docker Desktop.

1. Get the code and install packages.

   ```
   git clone https://github.com/shirii8/yatharth_Labs.git
   cd yatharth_Labs
   npm install
   ```

2. Create your local settings file.

   ```
   cp .env.example .env
   ```

   Fill in `.env`:

   - `DATABASE_URL` and `DIRECT_URL`: both `postgresql://yatharth:yatharth_local_only@localhost:5433/yatharth` for the Docker database below.
   - `SESSION_SECRET`, `PHONE_HASH_KEY`, `TOKEN_HASH_KEY`, `PHONE_ENC_KEY`: each a fresh random value. This prints one:

     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

   - `APP_BASE_URL=http://localhost:3000`, `NEXT_PUBLIC_LAB_NAME`, `NEXT_PUBLIC_LAB_PHONE`.
   - `DEMO_MODE=true`, `DEMO_OTP` (six digits) and `DEMO_STAFF_PASSWORD` (12 characters or more) for the demo logins.
   - `ANTHROPIC_API_KEY` is optional. Without it, patients see the rule-based wording and no AI paragraph.

3. Start the database, create the tables and load the demo data.

   ```
   npm run db:up
   npm run db:deploy
   npm run db:seed
   ```

4. Start the app and open http://localhost:3000 on a phone-sized window.

   ```
   npm run dev
   ```

5. Run the checks.

   ```
   npm run check        # lint, types, formatting, unit and database tests
   npm run test:e2e     # four end-to-end flows; needs the app running
   ```

   Database tests use a separate throwaway database (`yatharth_test`) and never touch the demo data.

## 2. How it is deployed

| Part | Where | Why |
| --- | --- | --- |
| App | Vercel, functions pinned to Mumbai (`bom1` in `vercel.json`) | Server rendering close to patients in Andhra Pradesh |
| Database | Supabase Postgres, Mumbai region (`ap-south-1`) | Health data stays in India (DPDP Act 2023) |
| SMS | Mock provider | The brief says to mock messages |
| AI | Claude API, only de-identified values sent | See the TDD, section on the AI part |

Steps:

1. Create a Supabase project and choose the specific region **South Asia (Mumbai)**; the host must contain `ap-south-1`. Under Connect, copy the **Session pooler** URL (port 5432) for `DIRECT_URL`, and the same URL with port **6543** (the transaction pooler) for `DATABASE_URL`. The direct connection is IPv6 only on the free plan, so use the session pooler. Use a password of letters and numbers only.
2. Import the GitHub repository into Vercel. `vercel.json` pins the region and runs `npm run vercel-build`, which applies migrations (`prisma migrate deploy`) and then builds.
3. Set the environment variables below in Vercel, for Production.
4. Load the demo data once, from a local machine, against the Supabase database:

   ```
   DATABASE_URL="<direct URL>" DIRECT_URL="<direct URL>" npm run db:seed
   ```

   The seed reads the other variables from your local `.env`, so they must match the ones set in Vercel (especially `PHONE_HASH_KEY`, `PHONE_ENC_KEY` and `TOKEN_HASH_KEY`).

### Environment variables (names only)

| Name | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres URL, used by the app |
| `DIRECT_URL` | yes | Direct Postgres URL, used only by migrations |
| `SESSION_SECRET` | yes | Keys the session token hashes |
| `PHONE_HASH_KEY` | yes | Keys the phone number hashes used for lookup |
| `PHONE_ENC_KEY` | yes | 32 bytes, base64: encrypts phone numbers (AES-256-GCM) |
| `TOKEN_HASH_KEY` | yes | Keys the link token and OTP hashes |
| `APP_BASE_URL` | yes | Public address, used in SMS links |
| `NEXT_PUBLIC_BRAND_NAME` | no | Product name, default Yatharth |
| `NEXT_PUBLIC_LAB_NAME` | yes | Lab name shown to patients |
| `NEXT_PUBLIC_LAB_PHONE` | yes | Number behind every "Call the lab" button |
| `SMS_PROVIDER` | no | `mock` (default) |
| `AI_PROVIDER` | no | `anthropic` (default) or `none` |
| `ANTHROPIC_API_KEY` | no | Turns on the AI paragraph |
| `AI_MODEL` | no | Default `claude-opus-5-5` |
| `AI_TIMEOUT_SECONDS` | no | Default 8 |
| `DEMO_MODE` | demo only | `true` allows the fixed demo code for the three demo numbers |
| `DEMO_OTP` | demo only | The fixed six-digit demo code |
| `DEMO_STAFF_PASSWORD` | seed only | Password given to the two demo staff accounts |
| `TEST_DATABASE_URL` | tests only | Throwaway database for database tests |

## 3. Demo logins for the reviewer

Demo mode is on in the demo deployment only. It must never be on with real patients.

**Patients** (open the app on a phone or a narrow window):

| Number | Who | What to look at |
| --- | --- | --- |
| +91 90000 00001 | Lakshmi Prasanna K, with Ramana Rao K and Anjali K | Low haemoglobin explained by rule, family tabs, a report still being prepared, Compact view with the trend since August |
| +91 90000 00002 | Venkata Rao M | Lipid report explained with the checked AI paragraph (when an API key is set), and an older link that has expired |
| +91 90000 00003 | Farzana Begum | Critical potassium: "Please call us", no values shown |

Code for all three on the live demo: **246810** (the deployment's `DEMO_OTP`). SMS is simulated, so no message arrives; any other number gets no code.

To see the lockout, type a wrong code five times for any number. Try **Easy view** (top right) for the simplified screens for older readers, and the language tabs for Telugu.

**Staff** at `/desk/sign-in`:

| Email | Role | Can do |
| --- | --- | --- |
| frontdesk@demo.lab | Front desk | Import, patients, resend, callbacks, flags, add family |
| labadmin@demo.lab | Lab admin | All of the above, plus wording approvals and the AI review |

Password for both on the live demo: **Desk-demo-2026!** (the `DEMO_STAFF_PASSWORD` the demo data was seeded with). These are demo-only accounts over synthetic data; a real deployment sets its own and turns `DEMO_MODE` off.

A sample LIS export to upload is in `samples/lis-export-2026-11-04.csv`. Uploading it again changes nothing.
