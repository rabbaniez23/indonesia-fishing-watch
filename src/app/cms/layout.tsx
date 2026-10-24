import { redirect } from "next/navigation";
import { CmsShell } from "@/components/cms/CmsShell";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

export const metadata = {
  title: {
    default: "IFW Studio · Panel Pengelola",
    template: "%s · IFW Studio",
  },
};

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Hanya Analyst (peneliti) dan Admin yang dapat mengakses area CMS
  if (!can(user.role, "dataset:import")) {
    redirect("/overview");
  }

  return <CmsShell user={user}>{children}</CmsShell>;
}
