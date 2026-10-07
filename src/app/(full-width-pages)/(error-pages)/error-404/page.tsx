import { Metadata } from "next";

import NotFound from "@/app/not-found";

export const metadata: Metadata = {
  title: "404 Not Found | Abidii Admin Dashboard",
  description: "The page you are looking for does not exist.",
};

/** Explicit /error-404 route - same page as the app-wide not-found. */
export default function Error404() {
  return <NotFound />;
}
