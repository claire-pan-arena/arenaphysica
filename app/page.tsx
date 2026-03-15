import { auth } from "@/auth";
import SignInPage from "./signin/page";
import Dashboard from "./dashboard";

export default async function Home() {
  const session = await auth();

  if (session) {
    const firstName = session.user?.name?.split(" ")[0] || "Operator";
    return <Dashboard firstName={firstName} />;
  }

  return <SignInPage />;
}
