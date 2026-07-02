import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { MesaPage } from "./mesa-page"

export default async function MesaServerPage({
  params,
}: {
  params: { slug: string; number: string }
}) {
  const num = parseInt(params.number)
  if (isNaN(num) || num < 1) notFound()

  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    include: {
      categories: {
        include: { products: { where: { isAvailable: true }, orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  })

  if (!establishment) notFound()
  if (num > (establishment.tableCount || 10)) notFound()

  const est = {
    id: establishment.id,
    name: establishment.name,
    slug: establishment.slug,
    phone: establishment.phone,
    logo: establishment.logo,
    description: establishment.description,
    cover: establishment.cover,
    primaryColor: establishment.primaryColor,
    backgroundColor: establishment.backgroundColor,
    textColor: establishment.textColor,
    headerColor: establishment.headerColor,
    colorsPublished: establishment.colorsPublished,
    defaultTheme: establishment.defaultTheme,
    tableCount: establishment.tableCount || 10,
    categories: establishment.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        badge: p.badge,
      })),
    })),
  }

  return <MesaPage establishment={est} tableNumber={num} />
}
