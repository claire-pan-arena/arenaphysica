import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DSDashboard from "./ds-dashboard";

export default async function DSPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  return <DSDashboard userEmail={session.user.email} userName={session.user?.name || "DS"} />;
}
