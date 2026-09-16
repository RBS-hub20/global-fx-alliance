import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
  description: "Apply for access to the Global FX Alliance dashboard.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
