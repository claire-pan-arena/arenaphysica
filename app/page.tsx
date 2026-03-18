import { auth } from "@/auth";
import { headers } from "next/headers";
import SignInPage from "./signin/page";
import Dashboard from "./dashboard";
import LandingPage from "./landing";

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  // Root domain shows landing page, not Ground Control
  if (host === "arenaphysica.ai" || host === "www.arenaphysica.ai") {
    return <LandingPage />;
  }

  if (process.env.NODE_ENV === "development") {
    return <Dashboard firstName="Dev" />;
  }

  const session = await auth();

  if (session) {
    const firstName = session.user?.name?.split(" ")[0] || "Operator";
    return <Dashboard firstName={firstName} />;
  }

  return <SignInPage />;
}
