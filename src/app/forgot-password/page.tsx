import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

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
