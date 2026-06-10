import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    <AuthShell
      title="Join XYZ Crypto"
      subtitle="Create your free account, built for the next generation of Web3"
      footer={null}
    >
      <SignupForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
