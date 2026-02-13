import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {
    return null;
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token)
    }
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|auth/login|auth/register|_next|favicon.ico).*)"
  ]
};
