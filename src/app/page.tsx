import SignInForm from "@/components/auth/SignInForm";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | Abidii Dashboard",
  description: "Login to Abidii Admin Dashboard",
};

export default function LoginPage() {
  return (
    <div className="relative p-6 bg-card z-1 sm:p-0">
      <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col bg-background sm:p-0">
        <SignInForm />
        <AuthBrandPanel />
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
