import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignInPage from "./signin/page";

export default async function Home() {
  const session = await auth();

  if (session) {
    // Logged in — show the actual app
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-8">
        <img src="/logo.svg" alt="Arena Physica" className="w-full max-w-3xl" />
      </div>
    );
  }

  // Not logged in — show login page at the root URL
  return <SignInPage />;
}
