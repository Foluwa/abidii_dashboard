import GridShape from "@/components/common/GridShape";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "404 Not Found | Abidii Admin Dashboard",
  description:
    "The page you are looking for does not exist.",
};

export default function Error404() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
      <GridShape />
      <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
        <h1 className="mb-8 font-bold text-foreground text-title-md xl:text-title-2xl">
          ERROR
        </h1>

        <Image
          src="/images/error/404.svg"
          alt="404"
          className="dark:hidden"
          width={472}
          height={152}
        />
        <Image
          src="/images/error/404-dark.svg"
          alt="404"
          className="hidden dark:block"
          width={472}
          height={152}
        />

        <p className="mt-10 mb-6 text-base text-muted-foreground sm:text-lg">
          We can’t seem to find the page you are looking for!
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-input bg-card px-5 py-3.5 text-sm font-medium text-muted-foreground shadow-theme-xs hover:bg-muted/50 hover:text-foreground"
        >
          Back to Home Page
        </Link>
      </div>
      {/* <!-- Footer --> */}
      <p className="absolute text-sm text-center text-muted-foreground -translate-x-1/2 bottom-6 left-1/2">
        &copy; {new Date().getFullYear()} - Abidii
      </p>
    </div>
  );
}
