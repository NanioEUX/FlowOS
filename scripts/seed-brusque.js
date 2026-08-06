const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const ESTABLISHMENT_ID = "cmqreujjq00005tz40hqkk659"

async function main() {
  console.log("🍔 Seeding Hamburgueria Brusque...")

  await prisma.banner.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.storyItem.deleteMany({ where: { story: { establishmentId: ESTABLISHMENT_ID } } })
  await prisma.story.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.additionalOption.deleteMany({ where: { product: { establishmentId: ESTABLISHMENT_ID } } })
  await prisma.product.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.category.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.stockItem.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.stockCategory.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })

  console.log("📦 Creating stock categories & items...")
  const sc = (name) => prisma.stockCategory.create({ data: { name, establishmentId: ESTABLISHMENT_ID } })
  const catCarnes = await sc("Carnes")
  const catPao = await sc("Pães")
  const catQueijos = await sc("Queijos")
  const catVegetais = await sc("Vegetais")
  const catBebidas = await sc("Bebidas")
  const catSorvetes = await sc("Sorvetes")

  const si = (name, unit, quantity, minQuantity, unitCost, categoryId) =>
    prisma.stockItem.create({ data: { name, unit, quantity, minQuantity, unitCost, categoryId, establishmentId: ESTABLISHMENT_ID } })

  const items = {
    paoBrioche: await si("Pão Brioche", "un", 100, 20, 1.50, catPao.id),
    paoAustraliano: await si("Pão Australiano", "un", 50, 10, 2.00, catPao.id),
    paoLeite: await si("Pão de Leite", "un", 80, 15, 1.80, catPao.id),
    hamb150: await si("Hambúrguer 150g", "un", 60, 20, 8.50, catCarnes.id),
    hamb200: await si("Hambúrguer 200g", "un", 40, 15, 11.00, catCarnes.id),
    frango: await si("Frango Empanado", "un", 30, 10, 6.00, catCarnes.id),
    costela: await si("Costela Desfiada", "kg", 5, 2, 35.00, catCarnes.id),
    bacon: await si("Bacon", "kg", 3, 1, 40.00, catCarnes.id),
    cheddar: await si("Queijo Cheddar", "kg", 4, 1, 30.00, catQueijos.id),
    mussarela: await si("Queijo Mussarela", "kg", 4, 1, 28.00, catQueijos.id),
    creamCheese: await si("Cream Cheese", "kg", 2, 1, 25.00, catQueijos.id),
    alface: await si("Alface", "un", 30, 10, 0.80, catVegetais.id),
    tomate: await si("Tomate", "kg", 5, 2, 8.00, catVegetais.id),
    cebola: await si("Cebola", "kg", 3, 1, 5.00, catVegetais.id),
    picles: await si("Picles", "kg", 2, 1, 12.00, catVegetais.id),
    coca: await si("Coca-Cola 350ml", "un", 48, 12, 3.50, catBebidas.id),
    guarana: await si("Guaraná 350ml", "un", 36, 12, 3.00, catBebidas.id),
    suco: await si("Suco Natural 500ml", "un", 20, 8, 4.50, catBebidas.id),
    sorvVanilla: await si("Sorvete Vanilla", "kg", 3, 1, 18.00, catSorvetes.id),
    sorvChocolate: await si("Sorvete Chocolate", "kg", 3, 1, 20.00, catSorvetes.id),
    sorvMorango: await si("Sorvete Morango", "kg", 2, 1, 19.00, catSorvetes.id),
    sorvPistache: await si("Sorvete Pistache", "kg", 2, 1, 25.00, catSorvetes.id),
  }

  console.log("📂 Creating categories...")
  const mkCat = (name, order) => prisma.category.create({ data: { name, order, establishmentId: ESTABLISHMENT_ID } })
  const catHamburguers = await mkCat("Hambúrgueres", 0)
  const catPromocoes = await mkCat("Promoções", 1)
  const catSorvetesC = await mkCat("Sorvetes", 2)
  const catPicoles = await mkCat("Picolés", 3)
  const catFits = await mkCat("Fits", 4)
  const catSemLactose = await mkCat("Sem Lactose", 5)
  const catBebidasC = await mkCat("Bebidas", 6)

  console.log("🍔 Creating products...")
  const mkP = (data) => prisma.product.create({ data: { ...data, establishmentId: ESTABLISHMENT_ID } })

  // Hambúrgueres
  const p1 = await mkP({ name: "Classic Burger", description: "Pão brioche, hambúrguer 150g, cheddar, alface, tomate e molho especial", price: 28.90, categoryId: catHamburguers.id, badge: "mais_vendido", order: 0, stockItemId: items.hamb150.id })
  const p2 = await mkP({ name: "Double Smash", description: "Dois hambúrgueres 150g, mussarela, cebola caramelizada e molho BBQ", price: 38.90, categoryId: catHamburguers.id, badge: "mais_vendido", order: 1, stockItemId: items.hamb200.id })
  const p3 = await mkP({ name: "Bacon Cheddar", description: "Hambúrguer 200g, bacon crocante, cheddar derretido e picles", price: 35.90, categoryId: catHamburguers.id, order: 2, stockItemId: items.hamb200.id })
  const p4 = await mkP({ name: "Costela Burger", description: "Costela desfiada, cream cheese, cebola crispy no pão australiano", price: 42.90, categoryId: catHamburguers.id, order: 3, stockItemId: items.costela.id })
  const p5 = await mkP({ name: "Frango Crispy", description: "Frango empanado crocante, alface, maionese e pão de leite", price: 26.90, categoryId: catHamburguers.id, order: 4, stockItemId: items.frango.id })

  // Promoções
  const p6 = await mkP({ name: "Combo Duplo", description: "2 hambúrgueres classic + 2 refris 350ml", price: 59.90, categoryId: catPromocoes.id, onSale: true, promoPrice: 49.90, order: 0 })
  const p7 = await mkP({ name: "Hambúrguer + Batata", description: "Classic Burger + Batata frita média", price: 38.90, categoryId: catPromocoes.id, onSale: true, promoPrice: 32.90, order: 1 })

  // Sorvetes
  const p8 = await mkP({ name: "Sorvete 500g", description: "500g de sorvete artesanal, 2 sabores", price: 25.90, categoryId: catSorvetesC.id, order: 0 })
  const p9 = await mkP({ name: "Sorvete 1kg", description: "1kg de sorvete artesanal, até 3 sabores", price: 45.90, categoryId: catSorvetesC.id, order: 1 })
  const p10 = await mkP({ name: "Açaí na Tigela", description: "Açaí 500ml com banana, granola e leite condensado", price: 22.90, categoryId: catSorvetesC.id, order: 2 })

  // Picolés
  await mkP({ name: "Picolé de Fruta", description: "Picolé artesanal de frutas naturais", price: 6.90, categoryId: catPicoles.id, order: 0 })
  await mkP({ name: "Picolé Premium", description: "Picolé cremoso artesanal (chocolate, morango ou pistache)", price: 9.90, categoryId: catPicoles.id, order: 1 })
  await mkP({ name: "Picolé Fit", description: "Picolé低 calórico de frutas, sem açúcar adicionado", price: 8.90, categoryId: catPicoles.id, order: 2 })

  // Fits
  await mkP({ name: "Burger Fit", description: "Hambúrguer de frango grelhado, alface, tomate e molho de iogurte", price: 32.90, categoryId: catFits.id, order: 0 })
  await mkP({ name: "Salada Caesar", description: "Alface, frango grelhado, parmesão e croutons", price: 28.90, categoryId: catFits.id, order: 1 })
  await mkP({ name: "Wrap Fit", description: "Tortilla integral com frango, cream light e vegetais", price: 26.90, categoryId: catFits.id, order: 2 })

  // Sem Lactose
  await mkP({ name: "Burger Sem Lactose", description: "Classic Burger preparado sem laticínios, com queijo vegano", price: 33.90, categoryId: catSemLactose.id, order: 0 })
  await mkP({ name: "Sorvete Sem Lactose", description: "Sorvete artesanal 500g, base de coco ou leite de amêndoa", price: 29.90, categoryId: catSemLactose.id, order: 1 })

  // Bebidas
  await mkP({ name: "Coca-Cola 350ml", description: "Lata 350ml gelada", price: 6.00, categoryId: catBebidasC.id, order: 0, stockItemId: items.coca.id })
  await mkP({ name: "Guaraná 350ml", description: "Lata 350ml gelada", price: 5.00, categoryId: catBebidasC.id, order: 1, stockItemId: items.guarana.id })
  await mkP({ name: "Suco Natural 500ml", description: "Suco natural de frutas frescas", price: 9.90, categoryId: catBebidasC.id, order: 2, stockItemId: items.suco.id })

  console.log("⚙️ Creating additional options...")
  const mkOpt = (data) => prisma.additionalOption.create({ data: { ...data, establishmentId: ESTABLISHMENT_ID } })

  // Ponto da carne - Classic Burger
  await mkOpt({ name: "Mal passada", inputType: "radio", selectionType: "required", groupName: "Ponto da carne", groupOrder: 0, price: 0, productId: p1.id })
  await mkOpt({ name: "Ao ponto", inputType: "radio", selectionType: "required", groupName: "Ponto da carne", groupOrder: 0, price: 0, productId: p1.id })
  await mkOpt({ name: "Bem passada", inputType: "radio", selectionType: "required", groupName: "Ponto da carne", groupOrder: 0, price: 0, productId: p1.id })

  // Extras - Classic Burger
  await mkOpt({ name: "Bacon extra", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 4.00, productId: p1.id })
  await mkOpt({ name: "Cheddar extra", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 3.00, productId: p1.id })
  await mkOpt({ name: "Ovo frito", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 2.50, productId: p1.id })

  // Sabores - Sorvete
  await mkOpt({ name: "Vanilla", inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price: 0, productId: p8.id })
  await mkOpt({ name: "Chocolate", inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price: 0, productId: p8.id })
  await mkOpt({ name: "Morango", inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price: 0, productId: p8.id })
  await mkOpt({ name: "Pistache", inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price: 0, productId: p8.id })

  await mkOpt({ name: "2° Sabor (opcional)", inputType: "radio", selectionType: "optional", groupName: "2° Sabor", groupOrder: 1, price: 0, productId: p8.id })
  await mkOpt({ name: "Calda de chocolate", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 2, price: 3.00, productId: p8.id })
  await mkOpt({ name: "Granola", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 2, price: 2.00, productId: p8.id })
  await mkOpt({ name: "Leite condensado", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 2, price: 2.50, productId: p8.id })

  // Extras - Double Smash
  await mkOpt({ name: "Bacon extra", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 0, price: 4.00, productId: p2.id })
  await mkOpt({ name: "Ovo frito", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 0, price: 2.50, productId: p2.id })

  console.log("🖼️ Creating banners...")
  await prisma.banner.create({ data: { title: "Combo Duplo com Desconto!", subtitle: "2 hambúrgueres + 2 refris por apenas R$ 49,90", ctaText: "Ver Oferta", ctaType: "category", ctaTarget: catPromocoes.id, gradientFrom: "from-orange-500", gradientTo: "to-red-500", order: 0, active: true, establishmentId: ESTABLISHMENT_ID } })
  await prisma.banner.create({ data: { title: "Novos Sabores de Sorvete", subtitle: "Experimente nossos novos sabores artesanais", ctaText: "Ver Sabores", ctaType: "category", ctaTarget: catSorvetesC.id, gradientFrom: "from-purple-500", gradientTo: "to-pink-500", order: 1, active: true, establishmentId: ESTABLISHMENT_ID } })
  await prisma.banner.create({ data: { title: "Linha Fit", subtitle: "Opções saudáveis sem abrir mão do sabor", ctaText: "Ver Fits", ctaType: "category", ctaTarget: catFits.id, gradientFrom: "from-green-500", gradientTo: "to-emerald-500", order: 2, active: true, establishmentId: ESTABLISHMENT_ID } })

  console.log("✅ Seed concluído!")
  console.log(`   23 itens de estoque`)
  console.log(`   7 categorias`)
  console.log(`   21 produtos`)
  console.log(`   3 banners`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
