import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  // A password-reset form has nothing to rank for and no reason to be in an
  // index. It is deliberately left crawlable rather than blocked in robots.txt:
  // a crawler has to be allowed to fetch the page to see this directive at all,
  // and blocking it would hide the very thing that keeps it out.
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a code to set a new one"
      footer={null}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
