import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.plansConfig.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      freeLimits: {
        maxProducts: 50,
        maxImagesPerProduct: 3,
        maxCategories: 15,
      },
      proLimits: {
        maxProducts: 100000,
        maxImagesPerProduct: 10,
        maxCategories: 200,
      },
      proPriceCup: 3000,
      proPriceUsd: 10,
      proDurationDays: 60,
      paymentInstructions:
        'Realiza la transferencia mediante Transfermóvil o EnZona e indica el número de operación.',
    },
  });

  console.log('Semilla de TuVitrina (plans_config) ejecutada correctamente.');
}

main()
  .catch((err) => {
    console.error('Error ejecutando semilla:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
