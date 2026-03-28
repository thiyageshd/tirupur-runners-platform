# Razorpay Test Credentials

> Only works when `RAZORPAY_KEY_ID` starts with `rzp_test_`

## Test Cards

**Use any values for expiry (future date), CVV (3 digits), and name.**

### Successful Payments

| Card Number          | Network    |
|----------------------|------------|
| 4111 1111 1111 1111  | Visa       |
| 5267 3181 8797 5449  | Mastercard |
| 3714 496353 98431    | Amex       |

### Failure Scenarios

| Card Number          | Behaviour           |
|----------------------|---------------------|
| 4000 0000 0000 0002  | Payment declined    |
| 4000 0000 0000 9995  | Insufficient funds  |

## UPI

| UPI ID               | Behaviour |
|----------------------|-----------|
| success@razorpay     | Succeeds  |
| failure@razorpay     | Fails     |

## Net Banking

Select any bank in test mode — it auto-succeeds.

## Wallets

Select any wallet in test mode — it auto-succeeds.
