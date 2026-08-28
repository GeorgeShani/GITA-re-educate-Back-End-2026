import * as Joi from 'joi';

// Fails fast on boot rather than at first use. Split into "required now"
// (Mongo/Redis/JWT — S1's own dependencies) and "required by its phase"
// (Stripe/Cloudinary/Gemini/Resend — S0 provisions these incrementally
// per the storefront backend plan, so they stay optional here and each
// slice's own module should assert what it needs when it needs it).
//
// `.allow('')` on every optional field matters: .env.example ships those
// keys present but unset (`APP_URL=`), and dotenv parses that as an
// empty string, not `undefined` — Joi's default string schema treats
// empty as invalid, so without `.allow('')` boot fails on a file that's
// only doing what an example file is supposed to do.
const optionalString = () => Joi.string().allow('').optional();

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  ROLE: Joi.string().valid('api', 'worker', 'all').default('all'),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
  APP_URL: optionalString(),

  MONGODB_URI: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Signs the guest-cart cookie (S8) — separate from JWT_SECRET so
  // rotating one doesn't invalidate the other.
  COOKIE_SECRET: Joi.string().min(16).required(),

  PAYMENT_PROVIDER: Joi.string().valid('stripe', 'mock').default('mock'),
  STRIPE_SECRET_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),

  CLOUDINARY_CLOUD_NAME: optionalString(),
  CLOUDINARY_API_KEY: optionalString(),
  CLOUDINARY_API_SECRET: optionalString(),
  CLOUDINARY_UPLOAD_PRESET: optionalString(),
  CLOUDINARY_WEBHOOK_SECRET: optionalString(),

  MAIL_PROVIDER: Joi.string()
    .valid('console', 'resend', 'noop')
    .default('console'),
  RESEND_API_KEY: optionalString(),
  MAIL_FROM: optionalString(),
  MAIL_FROM_NAME: optionalString(),
  MAIL_REPLY_TO: optionalString(),
  MAIL_WEBHOOK_SECRET: optionalString(),
  MAIL_DEV_REDIRECT: optionalString(),
  MAIL_DEV_ALLOWLIST: optionalString(),
  MAIL_ADMIN_RECIPIENTS: optionalString(),

  GEMINI_API_KEY: optionalString(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),

  // Admin moderation is Phase 6, out of scope for the storefront
  // backend (see the plan's "Consequences of excluding admin CRUD") —
  // without this, submitted reviews would sit `pending` forever with
  // nothing able to approve them. Defaults false so production behaves
  // correctly even if this is never set.
  REVIEWS_AUTO_APPROVE: Joi.boolean().default(false),
});
