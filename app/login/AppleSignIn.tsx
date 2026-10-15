import { signInWithSocial } from "./actions";

export default function AppleSignIn({
  intent,
}: {
  intent: "login" | "register";
}) {
  if (process.env.APPLE_AUTH_ENABLED !== "true") return null;

  return (
    <form
      className="apple-access-form"
      action={signInWithSocial.bind(null, "apple", intent)}
    >
      <button className="apple-access-button" type="submit">
        <svg
          width="20"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M17.05 12.54c.03 3.22 2.82 4.29 2.85 4.3-.02.08-.45 1.53-1.48 3.03-.89 1.3-1.82 2.59-3.28 2.62-1.43.03-1.89-.85-3.53-.85-1.63 0-2.14.82-3.5.88-1.41.05-2.48-1.41-3.38-2.7-1.84-2.66-3.25-7.51-1.36-10.8.94-1.63 2.62-2.66 4.44-2.69 1.39-.03 2.7.94 3.54.94.85 0 2.44-1.16 4.11-.99.7.03 2.66.28 3.92 2.13-.1.06-2.34 1.36-2.31 4.13ZM14.36 4.48c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.39.72-3.16 1.63-.7.81-1.31 2.1-1.15 3.33 1.2.09 2.44-.61 3.2-1.53Z" />
        </svg>
        <span>Continue with Apple</span>
      </button>
    </form>
  );
}