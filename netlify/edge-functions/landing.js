// The site's front door. Visitors arriving at "/" are sent to the right place:
// - signed in            -> their member dashboard
// - had an account here  -> the login page
// - new to the site      -> create an account
// The public homepage itself lives at /home.
export default async (request, context) => {
  const signedIn = Boolean(context.cookies.get('nf_jwt') || context.cookies.get('nf_refresh'));
  const returning = context.cookies.get('ut_member') === '1';
  const target = signedIn ? '/members' : returning ? '/login' : '/signup';
  const url = new URL(request.url);
  const location = new URL(target, url.origin);
  // Keep any query string (for example a referral ?ref= token).
  location.search = url.search;
  return new Response(null, {
    status: 302,
    headers: { Location: location.toString(), 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
};

export const config = { path: '/' };
