import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to XYZ Crypto for Web3 research, trading tools and the community.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const providers = {
    google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    github: !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET,
    twitter: !!process.env.TWITTER_CLIENT_ID && !!process.env.TWITTER_CLIENT_SECRET,
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your XYZ Crypto account"
      footer={null}
    >
      <Suspense fallback={<div className="h-72" />}>
        <LoginForm providers={providers} />
      </Suspense>
    </AuthShell>
  );
}
