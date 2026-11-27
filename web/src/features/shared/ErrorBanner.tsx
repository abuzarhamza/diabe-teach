import type { ApiHttpError } from "../../api/http-client.ts";

interface ErrorBannerProps {
  // The sentence the teacher reads; defaults to the refusal's own message.
  sentence?: string | null;
  // The API refusal behind it, if any: its code is shown in development, to tell domain errors apart.
  error?: ApiHttpError | null;
  // Announce the sentence as an alert (role="alert") rather than politely; the region stays a polite
  // status while it is empty, so an empty banner is never counted as an alert.
  alert?: boolean;
}

// A refusal as one plain sentence in an aria-live status region, so screen readers announce it.
// The region is always rendered (empty when there is nothing to say), so announcements are not missed.
export function ErrorBanner({ sentence, error, alert = false }: ErrorBannerProps) {
  const text = sentence ?? error?.message ?? "";
  const asAlert = alert && Boolean(text);
  return (
    <div
      className={text ? "toast err" : "toast"}
      role={asAlert ? "alert" : "status"}
      aria-live={asAlert ? "assertive" : "polite"}
    >
      {text && <span>{text}</span>}
      {text && error && import.meta.env.DEV && (
        <code className="toast-code">{error.code}</code>
      )}
    </div>
  );
}
