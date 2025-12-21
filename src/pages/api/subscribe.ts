import type { APIRoute } from 'astro';

// MailerLite API configuration
const MAILERLITE_API_KEY = import.meta.env.MAILERLITE_API_KEY;

// reCAPTCHA v3 secret key (keep this secret - never expose in frontend!)
const RECAPTCHA_SECRET_KEY = import.meta.env.RECAPTCHA_SECRET_KEY;

// Minimum score to accept (0.0 = likely bot, 1.0 = likely human)
// 0.5 is Google's recommended threshold
const RECAPTCHA_MIN_SCORE = 0.5;

// Group IDs for different submission types
const GROUP_EMAIL_ONLY = '174406282445326180'; // OMOKA ONLY EMAIL
const GROUP_FULL_DATA = '174406288850028377'; // OMOKA FULL DATA

interface SubscribeData {
  email: string;
  role?: string;
  teamSize?: string;
  website?: string;
  appUrl?: string;
  country?: string; // Auto-detected from browser
  recaptchaToken?: string; // reCAPTCHA v3 token
}

// reCAPTCHA verification response from Google
interface RecaptchaResponse {
  success: boolean;
  score?: number; // 0.0 - 1.0 (only in v3)
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

// Verify reCAPTCHA token with Google
async function verifyRecaptcha(token: string): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: RECAPTCHA_SECRET_KEY,
          response: token,
        }),
      },
    );

    const result: RecaptchaResponse = await response.json();

    if (!result.success) {
      console.error('reCAPTCHA verification failed:', result['error-codes']);
      return { success: false, error: 'Verification failed' };
    }

    // Check score (v3 specific)
    if (result.score !== undefined && result.score < RECAPTCHA_MIN_SCORE) {
      console.warn(`reCAPTCHA low score: ${result.score}`);
      return { success: false, score: result.score, error: 'Low score' };
    }

    return { success: true, score: result.score };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, error: 'Verification request failed' };
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const data: SubscribeData = await request.json();

    // Validate email
    if (!data.email || !isValidEmail(data.email)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Verify reCAPTCHA if token is provided and secret key is configured
    if (RECAPTCHA_SECRET_KEY && data.recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(data.recaptchaToken);

      if (!recaptchaResult.success) {
        console.warn(
          `reCAPTCHA blocked submission for: ${data.email}, reason: ${recaptchaResult.error}`,
        );
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Security verification failed. Please try again.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      console.log(
        `reCAPTCHA passed for: ${data.email}, score: ${recaptchaResult.score}`,
      );
    } else if (RECAPTCHA_SECRET_KEY && !data.recaptchaToken) {
      // If secret is configured but no token provided, log warning but allow
      // This handles cases where reCAPTCHA script failed to load
      console.warn(`No reCAPTCHA token for submission: ${data.email}`);
    }

    // Check if MailerLite API key is configured
    if (!MAILERLITE_API_KEY) {
      console.error('MailerLite API key not configured');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Server configuration error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Determine if this is a full data submission or email-only
    const hasFullData =
      data.role && data.teamSize && data.website && data.appUrl;
    const groupId = hasFullData ? GROUP_FULL_DATA : GROUP_EMAIL_ONLY;

    // Prepare MailerLite subscriber data
    // Fields must exist in MailerLite dashboard (create them as custom fields)
    const subscriberData: Record<string, unknown> = {
      email: data.email,
      groups: [groupId],
      fields: {},
    };

    // Always include country if provided
    if (data.country) {
      (subscriberData.fields as Record<string, string>).country = data.country;
    }

    // Include optional fields only for full data submissions
    if (hasFullData) {
      const fields = subscriberData.fields as Record<string, string>;
      fields.role = data.role!;
      fields.team_size = data.teamSize!;
      fields.company_website = data.website!;
      fields.app_url = data.appUrl!;
    }

    // Send to MailerLite API
    // Docs: https://developers.mailerlite.com/docs/#mailerlite-api
    const response = await fetch(
      'https://connect.mailerlite.com/api/subscribers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${MAILERLITE_API_KEY}`,
        },
        body: JSON.stringify(subscriberData),
      },
    );

    const result = await response.json();

    if (response.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          message: hasFullData
            ? 'All set! The launch details are on their way to your inbox.'
            : 'Request received. You should receive the details shortly.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    } else {
      // Handle MailerLite errors
      console.error('MailerLite error:', result);

      // Check for duplicate subscriber (email already exists)
      if (
        response.status === 422 ||
        result.message?.toLowerCase().includes('already')
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'This email is already on our list!',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to subscribe. Please try again.',
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Server error. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

// Email validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
