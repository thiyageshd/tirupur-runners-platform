# Testing Steps — Login & Payments
**App:** https://dev.tirupurrunners.com
**Rule:** All test accounts must be prefixed with "Test" (e.g., Test Payer, Test Runner)

---

## FLOW 1 — Password Login

1. Go to https://dev.tirupurrunners.com/members/login
   - Expected: Login page loads with Password tab active

2. Enter a wrong email and any password → click Login
   - Expected: "Invalid credentials" error shown

3. Enter correct email and wrong password → click Login
   - Expected: "Invalid credentials" error shown

4. Enter phone number (10 digits) and correct password → click Login
   - Expected: Logs in and redirects to /members/dashboard

5. Log out → login again using email and correct password
   - Expected: Logs in successfully

6. After login, try visiting /members/login directly
   - Expected: Redirects to /members/dashboard


---

## FLOW 2 — Forgot Password / Reset

1. Click "Forgot Password?" on the login page
   - Expected: Navigates to /members/forgot-password

2. Enter an unregistered email → click Send OTP
   - Expected: Error shown — user not found

3. Enter a valid registered email → click Send OTP
   - Expected: "OTP sent" message appears. Resend button disabled for 60 seconds.

4. Enter a wrong OTP + new password → click Reset
   - Expected: "Invalid or expired OTP" error

5. Enter correct OTP + two passwords that don't match → click Reset
   - Expected: "Passwords do not match" error

6. Enter correct OTP + matching password (minimum 8 characters) → click Reset
   - Expected: Success screen shown, auto-redirects to login after 2 seconds

7. Login using the new password
   - Expected: Logs in successfully

8. Try using the same OTP again
   - Expected: "Invalid or expired OTP" error


---

## FLOW 3 — New Member Payment (after admin approval)

Setup: Register a test user "Test Payer", get admin to approve them first.

1. Login as Test Payer
   - Expected: Dashboard shows membership status as Pending or no membership

2. Click "Get Membership — ₹2,000"
   - Expected: Razorpay payment modal opens

3. Close the modal without paying
   - Expected: Dashboard unchanged, button still visible

4. Open Razorpay again → use test card:
   - Card number: 4111 1111 1111 1111
   - Expiry: any future date
   - CVV: any 3 digits
   - Expected: Payment succeeds

5. After payment completes
   - Expected: Dashboard refreshes, membership badge changes to Active

6. Go to the Receipts tab
   - Expected: Payment entry appears with amount ₹2,000 and today's date

7. Click the Receipt button
   - Expected: Printable receipt opens in a new tab with member name, amount, and payment details


---

## FLOW 4 — Membership Renewal (expired member)

1. Login as a member with an Expired membership
   - Expected: Dashboard shows "Renew Membership — ₹1,500" button

2. Click Renew → complete Razorpay payment using test card
   - Expected: Membership badge changes to Active

3. Go to the Receipts tab
   - Expected: New ₹1,500 entry appears alongside previous receipts


---

## FLOW 5 — Admin Verifies Payment

1. Login as admin → go to /admin
   - Expected: Stats panel visible at the top

2. Check the Active count
   - Expected: Increased by 1 compared to before the test payment

3. Go to Members tab → search "Test Payer"
   - Expected: Status shows "active", Year and Valid Until are populated

4. Check the Total Revenue card
   - Expected: Increased by ₹2,000


---

## Razorpay Test Cards

Success card:  4111 1111 1111 1111 — any future expiry — any CVV
Failure card:  4000 0000 0000 0002 — any future expiry — any CVV

Note: Test mode is active when Razorpay Key ID starts with "rzp_test_"
