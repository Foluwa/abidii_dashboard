import Image from "next/image";
import Link from "next/link";

/** Right-hand brand panel shared by the sign-in screens (hidden below lg). */
export default function AuthBrandPanel() {
  return (
    <div className="hidden h-full w-full items-center border-l border-border bg-zinc-950 lg:grid dark:bg-zinc-900 lg:w-1/2">
      <div className="flex flex-col items-center justify-center gap-4 px-8">
        <Link href="/dashboard" className="block">
          <Image
            width={231}
            height={48}
            src="/images/logo/auth-logo.svg"
            alt="Abidii"
          />
        </Link>
        <p className="max-w-xs text-center text-sm text-zinc-400">
          Admin dashboard for the Abidii language-learning app
        </p>
      </div>
    </div>
  );
}
