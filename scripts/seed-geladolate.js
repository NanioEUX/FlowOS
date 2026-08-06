const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const ESTABLISHMENT_ID = "cmqpcbz3p00009mts6law5jms"

const img = (q) => `https://images.unsplash.com/${q}?w=600&h=600&fit=crop&auto=format`

const IMGS = {
  casquinhaSimples: img("photo-1570197571499-166b36435e9f"),
  casquinhaDupla: img("photo-1563805042-7684c019e1cb"),
  pote500g: img("photo-1497034825429-c343d7c6a68f"),
  pote1kg: img("photo-1563805042-7684c019e1cb"),
  sundaeClassico: img("photo-1579954115563-e72bf1381629"),
  sundaeEspecial: img("photo-1551024709-8f23befc6f87"),
  tortone: img("photo-1623156815412-98e3e4e5e1e5"),
  bananaSplit: img("photo-1577805947697-89e18249d767"),
  picoleFruta: img("photo-1577805947697-89e18249d767"),
  picoleCremoso: img("photo-1626700051175-6818013e1d4f"),
  picolePremium: img("photo-1505394033641-f50b8d5e5e43"),
  picoleCoco: img("photo-1573821663912-569905455b1c"),
  paletaMexicana: img("photo-1556881286-fc691516f2b0"),
  sorveteFit: img("photo-1497034825429-c343d7c6a68f"),
  acaiFit: img("photo-1590301157890-4810ed352733"),
  picoleFit: img("photo-1577805947697-89e18249d767"),
  sorveBowl: img("photo-1590301157890-4810ed352733"),
  milkshakeFit: img("photo-1572490122747-3968b75cc699"),
  sorveteVegCoco: img("photo-1497034825429-c343d7c6a68f"),
  sorveteVegAmendoa: img("photo-1563805042-7684c019e1cb"),
  acaiVegano: img("photo-1590301157890-4810ed352733"),
  picoleVegano: img("photo-1577805947697-89e18249d767"),
  sundaeVegano: img("photo-1551024709-8f23befc6f87"),
  milkshakeVegano: img("photo-1572490122747-3968b75cc699"),
  sorveteSemLactose: img("photo-1497034825429-c343d7c6a68f"),
  casqSemLactose: img("photo-1570197571499-166b36435e9f"),
  picoleSemLactose: img("photo-1577805947697-89e18249d767"),
  acaiSemLactose: img("photo-1590301157890-4810ed352733"),
  sundaeSemLactose: img("photo-1579954115563-e72bf1381629"),
  sorveteSemAcucar: img("photo-1497034825429-c343d7c6a68f"),
  picoleSemAcucar: img("photo-1577805947697-89e18249d767"),
  acaiSemAcucar: img("photo-1590301157890-4810ed352733"),
  sundaeSemAcucar: img("photo-1551024709-8f23befc6f87"),
  milkshakeSemAcucar: img("photo-1572490122747-3968b75cc699"),
  acaiTradicional: img("photo-1590301157890-4810ed352733"),
  acaiPremium: img("photo-1590301157890-4810ed352733"),
  acaiEnergetico: img("photo-1590301157890-4810ed352733"),
  bowlTropical: img("photo-1590301157890-4810ed352733"),
  milkshakeClassico: img("photo-1572490122747-3968b75cc699"),
  milkshakeEspecial: img("photo-1572490122747-3968b75cc699"),
  milkshakeOreo: img("photo-1572490122747-3968b75cc699"),
  milkshakeNutella: img("photo-1572490122747-3968b75cc699"),
  milkshakeFrutas: img("photo-1572490122747-3968b75cc699"),
  sucoNatural: img("photo-1622597467836-f3285f2131b8"),
  cocaCola: img("photo-1629203851122-3716dbd57c3f"),
  guarana: img("photo-1558618666-fcd25c85f82e"),
  aguaMineral: img("photo-1560020161-2a5ec6a81d24"),
  chaGelado: img("photo-1556679343-c7306c1976bc"),
}

async function main() {
  console.log("🍨 Seeding Geladolate Sorveteria...")

  await prisma.banner.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.storyItem.deleteMany({ where: { story: { establishmentId: ESTABLISHMENT_ID } } })
  await prisma.story.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.additionalOption.deleteMany({ where: { product: { establishmentId: ESTABLISHMENT_ID } } })
  await prisma.product.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })
  await prisma.category.deleteMany({ where: { establishmentId: ESTABLISHMENT_ID } })

  const mkCat = (name, order) => prisma.category.create({ data: { name, order, establishmentId: ESTABLISHMENT_ID } })

  const catSorvetes = await mkCat("Sorvetes", 0)
  const catPicoles = await mkCat("Picolés", 1)
  const catFits = await mkCat("Fits", 2)
  const catVeganos = await mkCat("Veganos", 3)
  const catSemLactose = await mkCat("Sem Lactose", 4)
  const catSemAcucar = await mkCat("Sem Açúcar", 5)
  const catAcais = await mkCat("Açaís & Bowls", 6)
  const catMilkshakes = await mkCat("Milkshakes", 7)
  const catBebidas = await mkCat("Bebidas", 8)

  const mkP = (data) => prisma.product.create({ data: { ...data, establishmentId: ESTABLISHMENT_ID } })

  // ============ SORVETES ============
  console.log("🍦 Creating Sorvetes...")
  await mkP({ name: "Casquinha Simples", description: "1 bola de sorvete artesanal na casquinha cremosa", price: 8.90, categoryId: catSorvetes.id, order: 0, image: IMGS.casquinhaSimples })
  await mkP({ name: "Casquinha Dupla", description: "2 bolas de sorvete artesanal na casquinha, escolha seus sabores", price: 13.90, categoryId: catSorvetes.id, order: 1, image: IMGS.casquinhaDupla, badge: "mais_vendido" })
  await mkP({ name: "Sorvete Pote 500g", description: "500g de sorvete artesanal, até 2 sabores", price: 32.90, categoryId: catSorvetes.id, order: 2, image: IMGS.pote500g, onSale: true, promoPrice: 27.90 })
  await mkP({ name: "Sorvete Pote 1kg", description: "1kg de sorvete artesanal, até 3 sabores", price: 54.90, categoryId: catSorvetes.id, order: 3, image: IMGS.pote1kg })
  await mkP({ name: "Sundae Clássico", description: "Sorvete com calda, chantilly e cereja", price: 19.90, categoryId: catSorvetes.id, order: 4, image: IMGS.sundaeClassico })
  await mkP({ name: "Sundae Especial", description: "Sorvete com frutas frescas, granola, calda artesanal e chantilly", price: 24.90, categoryId: catSorvetes.id, order: 5, image: IMGS.sundaeEspecial })
  await mkP({ name: "Tortone", description: "Sorvete coberto com chocolate belga crocante e amendoim", price: 22.90, categoryId: catSorvetes.id, order: 6, image: IMGS.tortone })
  await mkP({ name: "Banana Split", description: "3 bolas de sorvete, banana, calda, chantilly e cereja", price: 29.90, categoryId: catSorvetes.id, order: 7, image: IMGS.bananaSplit, badge: "destaque" })

  // ============ PICOLÉS ============
  console.log("🍡 Creating Picolés...")
  await mkP({ name: "Picolé de Fruta", description: "Picolé artesanal de frutas naturais — morango, limão, manga ou maracujá", price: 7.90, categoryId: catPicoles.id, order: 0, image: IMGS.picoleFruta })
  await mkP({ name: "Picolé Cremoso", description: "Picolé cremoso de sorvete — chocolate, baunilha ou morango", price: 9.90, categoryId: catPicoles.id, order: 1, image: IMGS.picoleCremoso, badge: "mais_vendido" })
  await mkP({ name: "Picolé Premium", description: "Picolé premium com cobertura dupla de chocolate belga", price: 12.90, categoryId: catPicoles.id, order: 2, image: IMGS.picolePremium })
  await mkP({ name: "Picolé de Coco", description: "Picolé cremoso de coco com raspas de limão tahiti", price: 10.90, categoryId: catPicoles.id, order: 3, image: IMGS.picoleCoco })
  await mkP({ name: "Paleta Mexicana", description: "Picolé mexicano com chili, limão e sal — um choque de sabores", price: 11.90, categoryId: catPicoles.id, order: 4, image: IMGS.paletaMexicana })

  // ============ FITS ============
  console.log("💪 Creating Fits...")
  await mkP({ name: "Sorvete Fit Proteico", description: "Sorvete baixo em gordura com whey protein, até 2 sabores", price: 18.90, categoryId: catFits.id, order: 0, image: IMGS.sorveteFit })
  await mkP({ name: "Açaí Fit 500ml", description: "Açaí puro com granola, banana e mel sem açúcar", price: 24.90, categoryId: catFits.id, order: 1, image: IMGS.acaiFit, badge: "destaque" })
  await mkP({ name: "Picolé Fit", description: "Picolé de frutas naturais sem açúcar adicionado", price: 9.90, categoryId: catFits.id, order: 2, image: IMGS.picoleFit })
  await mkP({ name: "Sorvete Bowl", description: "Bowl de sorvete fit com frutas frescas e granola caseira", price: 22.90, categoryId: catFits.id, order: 3, image: IMGS.sorveBowl })
  await mkP({ name: "Milkshake Fit", description: "Milkshake proteico de banana com whey e canela", price: 19.90, categoryId: catFits.id, order: 4, image: IMGS.milkshakeFit })

  // ============ VEGANOS ============
  console.log("🌱 Creating Veganos...")
  await mkP({ name: "Sorvete Vegano de Coco", description: "Sorvete 100% vegano base de coco cremoso, até 2 sabores", price: 16.90, categoryId: catVeganos.id, order: 0, image: IMGS.sorveteVegCoco, badge: "destaque" })
  await mkP({ name: "Sorvete Vegano de Amêndoa", description: "Sorvete vegano base de amêndoa, textura sedosa, até 2 sabores", price: 18.90, categoryId: catVeganos.id, order: 1, image: IMGS.sorveteVegAmendoa })
  await mkP({ name: "Açaí Vegano 500ml", description: "Açaí puro com banana, granola vegana e frutas frescas", price: 22.90, categoryId: catVeganos.id, order: 2, image: IMGS.acaiVegano })
  await mkP({ name: "Picolé Vegano", description: "Picolé de frutas 100% vegano, sem laticínios nem corantes", price: 9.90, categoryId: catVeganos.id, order: 3, image: IMGS.picoleVegano })
  await mkP({ name: "Sundae Vegano", description: "Sorvete vegano com calda de frutas e chantilly de coco", price: 21.90, categoryId: catVeganos.id, order: 4, image: IMGS.sundaeVegano })
  await mkP({ name: "Milkshake Vegano", description: "Milkshake de banana com chocolate 70% vegano", price: 17.90, categoryId: catVeganos.id, order: 5, image: IMGS.milkshakeVegano })

  // ============ SEM LACTOSE ============
  console.log("🚫 Creating Sem Lactose...")
  await mkP({ name: "Sorvete Sem Lactose", description: "Sorvete artesanal sem lactose, até 2 sabores", price: 16.90, categoryId: catSemLactose.id, order: 0, image: IMGS.sorveteSemLactose, badge: "mais_vendido" })
  await mkP({ name: "Casquinha Sem Lactose", description: "Casquinha cremosa com sorvete sem lactose", price: 10.90, categoryId: catSemLactose.id, order: 1, image: IMGS.casqSemLactose })
  await mkP({ name: "Picolé Sem Lactose", description: "Picolé de frutas naturais sem lactose", price: 8.90, categoryId: catSemLactose.id, order: 2, image: IMGS.picoleSemLactose })
  await mkP({ name: "Açaí Sem Lactose 500ml", description: "Açaí 500ml preparado sem produtos lácteos", price: 22.90, categoryId: catSemLactose.id, order: 3, image: IMGS.acaiSemLactose })
  await mkP({ name: "Sundae Sem Lactose", description: "Sundae com sorvete sem lactose e chantilly vegetal", price: 19.90, categoryId: catSemLactose.id, order: 4, image: IMGS.sundaeSemLactose })

  // ============ SEM AÇÚCAR ============
  console.log("🚫 Creating Sem Açúcar...")
  await mkP({ name: "Sorvete Sem Açúcar", description: "Sorvete adoçado com eritritol, até 2 sabores", price: 17.90, categoryId: catSemAcucar.id, order: 0, image: IMGS.sorveteSemAcucar })
  await mkP({ name: "Picolé Sem Açúcar", description: "Picolé de frutas sem açúcar adicionado — adoçado naturalmente", price: 8.90, categoryId: catSemAcucar.id, order: 1, image: IMGS.picoleSemAcucar })
  await mkP({ name: "Açaí Sem Açúcar 500ml", description: "Açaí 500ml sem açúcar com frutas frescas e granola", price: 23.90, categoryId: catSemAcucar.id, order: 2, image: IMGS.acaiSemAcucar })
  await mkP({ name: "Sundae Sem Açúcar", description: "Sundae com sorvete sem açúcar e frutas frescas", price: 20.90, categoryId: catSemAcucar.id, order: 3, image: IMGS.sundaeSemAcucar })
  await mkP({ name: "Milkshake Sem Açúcar", description: "Milkshake de frutas com leite vegetal e adoçante natural", price: 18.90, categoryId: catSemAcucar.id, order: 4, image: IMGS.milkshakeSemAcucar })

  // ============ AÇAÍS & BOWLS ============
  console.log("🫐 Creating Açaís & Bowls...")
  await mkP({ name: "Açaí Tradicional 500ml", description: "Açaí cremoso com banana, granola e leite condensado", price: 22.90, categoryId: catAcais.id, order: 0, image: IMGS.acaiTradicional })
  await mkP({ name: "Açaí Premium 500ml", description: "Açaí com frutas frescas, granola, mel e paçoca", price: 29.90, categoryId: catAcais.id, order: 1, image: IMGS.acaiPremium, badge: "destaque" })
  await mkP({ name: "Açaí Energético", description: "Açaí com banana, aveia, whey protein e mel", price: 26.90, categoryId: catAcais.id, order: 2, image: IMGS.acaiEnergetico })
  await mkP({ name: "Bowl Tropical", description: "Açaí com manga, kiwi, granola e coco ralado", price: 27.90, categoryId: catAcais.id, order: 3, image: IMGS.bowlTropical })

  // ============ MILKSHAKES ============
  console.log("🥤 Creating Milkshakes...")
  await mkP({ name: "Milkshake Clássico", description: "Milkshake cremoso — chocolate, morango ou baunilha", price: 16.90, categoryId: catMilkshakes.id, order: 0, image: IMGS.milkshakeClassico })
  await mkP({ name: "Milkshake Especial", description: "Milkshake com chantilly, calda artesanal e cobertura crocante", price: 21.90, categoryId: catMilkshakes.id, order: 1, image: IMGS.milkshakeEspecial })
  await mkP({ name: "Milkshake Oreo", description: "Milkshake de chocolate com biscoito Oreo triturado", price: 22.90, categoryId: catMilkshakes.id, order: 2, image: IMGS.milkshakeOreo, badge: "mais_vendido" })
  await mkP({ name: "Milkshake Nutella", description: "Milkshake cremoso com Nutella e chantilly", price: 24.90, categoryId: catMilkshakes.id, order: 3, image: IMGS.milkshakeNutella })
  await mkP({ name: "Milkshake de Frutas", description: "Milkshake natural de morango, manga ou banana", price: 17.90, categoryId: catMilkshakes.id, order: 4, image: IMGS.milkshakeFrutas })

  // ============ BEBIDAS ============
  console.log("🥤 Creating Bebidas...")
  await mkP({ name: "Suco Natural 500ml", description: "Suco natural de frutas frescas preparado na hora", price: 9.90, categoryId: catBebidas.id, order: 0, image: IMGS.sucoNatural })
  await mkP({ name: "Coca-Cola 350ml", description: "Lata 350ml gelada", price: 6.00, categoryId: catBebidas.id, order: 1, image: IMGS.cocaCola })
  await mkP({ name: "Guaraná 350ml", description: "Lata 350ml gelada", price: 5.00, categoryId: catBebidas.id, order: 2, image: IMGS.guarana })
  await mkP({ name: "Água Mineral 500ml", description: "Garrafa 500ml — com ou sem gás", price: 4.00, categoryId: catBebidas.id, order: 3, image: IMGS.aguaMineral })
  await mkP({ name: "Chá Gelado 500ml", description: "Chá gelado artesanal — limão ou maracujá", price: 7.90, categoryId: catBebidas.id, order: 4, image: IMGS.chaGelado })

  // ============ ADDITIONAL OPTIONS ============
  console.log("⚙️ Creating additional options...")
  const mkOpt = (data) => prisma.additionalOption.create({ data: { ...data, establishmentId: ESTABLISHMENT_ID } })

  // Casquinha Dupla - Sabores
  const casqDupla = await prisma.product.findFirst({ where: { establishmentId: ESTABLISHMENT_ID, name: "Casquinha Dupla" } })
  if (casqDupla) {
    for (const sabor of ["Chocolate", "Baunilha", "Morango", "Pistache", "Cookies", "Nutella"]) {
      const price = sabor === "Nutella" ? 2.00 : 0
      await mkOpt({ name: sabor, inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price, productId: casqDupla.id })
      await mkOpt({ name: sabor, inputType: "radio", selectionType: "required", groupName: "2° Sabor", groupOrder: 1, price, productId: casqDupla.id })
    }
  }

  // Pote 500g - Sabores
  const pote500 = await prisma.product.findFirst({ where: { establishmentId: ESTABLISHMENT_ID, name: "Sorvete Pote 500g" } })
  if (pote500) {
    for (const sabor of ["Chocolate", "Baunilha", "Morango", "Pistache", "Cookies", "Nutella", "Framboesa", "Limão"]) {
      const price = ["Nutella", "Pistache"].includes(sabor) ? 2.00 : 0
      await mkOpt({ name: sabor, inputType: "radio", selectionType: "required", groupName: "1° Sabor", groupOrder: 0, price, productId: pote500.id })
      await mkOpt({ name: sabor, inputType: "radio", selectionType: "required", groupName: "2° Sabor", groupOrder: 1, price, productId: pote500.id })
    }
  }

  // Sundae Clássico - Calda + Extras
  const sundae = await prisma.product.findFirst({ where: { establishmentId: ESTABLISHMENT_ID, name: "Sundae Clássico" } })
  if (sundae) {
    await mkOpt({ name: "Chocolate", inputType: "radio", selectionType: "required", groupName: "Calda", groupOrder: 0, price: 0, productId: sundae.id })
    await mkOpt({ name: "Morango", inputType: "radio", selectionType: "required", groupName: "Calda", groupOrder: 0, price: 0, productId: sundae.id })
    await mkOpt({ name: "Caramelo", inputType: "radio", selectionType: "required", groupName: "Calda", groupOrder: 0, price: 0, productId: sundae.id })
    await mkOpt({ name: "Nutella", inputType: "radio", selectionType: "required", groupName: "Calda", groupOrder: 0, price: 3.00, productId: sundae.id })
    await mkOpt({ name: "Granola", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 2.00, productId: sundae.id })
    await mkOpt({ name: "Leite Condensado", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 2.00, productId: sundae.id })
    await mkOpt({ name: "Amendoim", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 1.50, productId: sundae.id })
  }

  // Açaí Premium - Coberturas
  const acaiPremium = await prisma.product.findFirst({ where: { establishmentId: ESTABLISHMENT_ID, name: "Açaí Premium 500ml" } })
  if (acaiPremium) {
    await mkOpt({ name: "Mel", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 0, price: 0, productId: acaiPremium.id })
    await mkOpt({ name: "Paçoca", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 0, price: 2.00, productId: acaiPremium.id })
    await mkOpt({ name: "Leite Condensado", inputType: "checkbox", selectionType: "optional", groupName: "Coberturas", groupOrder: 0, price: 2.00, productId: acaiPremium.id })
    await mkOpt({ name: "Granola", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 0, productId: acaiPremium.id })
    await mkOpt({ name: "Banana", inputType: "checkbox", selectionType: "optional", groupName: "Extras", groupOrder: 1, price: 0, productId: acaiPremium.id })
  }

  // Milkshake Oreo - Tamanho
  const milkOreo = await prisma.product.findFirst({ where: { establishmentId: ESTABLISHMENT_ID, name: "Milkshake Oreo" } })
  if (milkOreo) {
    await mkOpt({ name: "400ml", inputType: "radio", selectionType: "required", groupName: "Tamanho", groupOrder: 0, price: 0, productId: milkOreo.id })
    await mkOpt({ name: "600ml", inputType: "radio", selectionType: "required", groupName: "Tamanho", groupOrder: 0, price: 4.00, productId: milkOreo.id })
  }

  // ============ BANNERS ============
  console.log("🖼️ Creating banners...")
  await prisma.banner.create({ data: { title: "Sorvetes Artesanais", subtitle: "Sabores feitos com amor e ingredientes naturais", ctaText: "Ver Sabores", ctaType: "category", ctaTarget: catSorvetes.id, gradientFrom: "from-pink-500", gradientTo: "to-purple-500", order: 0, active: true, establishmentId: ESTABLISHMENT_ID } })
  await prisma.banner.create({ data: { title: "Linha Vegana", subtitle: "Sorvetes 100% vegetais, sem laticínios", ctaText: "Ver Veganos", ctaType: "category", ctaTarget: catVeganos.id, gradientFrom: "from-green-500", gradientTo: "to-emerald-500", order: 1, active: true, establishmentId: ESTABLISHMENT_ID } })
  await prisma.banner.create({ data: { title: "Promoção Pote 500g", subtitle: "Leve por apenas R$ 27,90 (antes R$ 32,90)", ctaText: "Aproveitar", ctaType: "category", ctaTarget: catSorvetes.id, gradientFrom: "from-orange-400", gradientTo: "to-red-500", order: 2, active: true, establishmentId: ESTABLISHMENT_ID } })

  const totalProds = await prisma.product.count({ where: { establishmentId: ESTABLISHMENT_ID } })
  console.log("✅ Seed Geladolate concluído!")
  console.log(`   9 categorias`)
  console.log(`   ${totalProds} produtos com fotos`)
  console.log(`   3 banners`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
