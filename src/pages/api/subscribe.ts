import type { APIRoute } from 'astro';

// MailerLite API configuration
const MAILERLITE_API_KEY = import.meta.env.MAILERLITE_API_KEY;

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

    // Check if API key is configured
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
            ? "Welcome! You've unlocked all rewards."
            : "You're on the list!",
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
