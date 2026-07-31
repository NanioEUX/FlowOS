import { redirect } from "next/navigation"
import { getSaasAdmin } from "@/lib/saas-admin-auth"

export default async function SaasAdminRoot() {
  const admin = await getSaasAdmin()
  if (admin) redirect("/admin-saas/dashboard")
  redirect("/admin-saas/login")
}
