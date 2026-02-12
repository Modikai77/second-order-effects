import { prisma } from "@/lib/prisma";

async function main() {
  const theme = await prisma.theme.create({
    data: {
      statement: "AI agents reduce custom software development costs by 60%.",
      probability: 0.4,
      horizonMonths: 36
    }
  });

  await prisma.themeEffect.createMany({
    data: [
      {
        themeId: theme.id,
        layer: "FIRST",
        description: "SaaS seat pricing pressure increases.",
        impactDirection: "NEG",
        confidence: "MED",
        orderIndex: 0
      },
      {
        themeId: theme.id,
        layer: "SECOND",
        description: "CIO budgets tilt toward compute and orchestration.",
        impactDirection: "POS",
        confidence: "MED",
        orderIndex: 0
      }
    ]
  });

  console.log(`Seeded theme ${theme.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
