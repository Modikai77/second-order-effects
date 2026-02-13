import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BOOTSTRAP_EMAIL = process.env.BOOTSTRAP_EMAIL ?? "bootstrap@local.local";
const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD ?? "bootstrap-password";

async function backfillOwnership() {
  const user = await prisma.user.findUnique({ where: { email: BOOTSTRAP_EMAIL } });

  const bootstrapUser =
    user ??
    (await prisma.user.create({
      data: {
        email: BOOTSTRAP_EMAIL,
        name: "Bootstrap User",
        passwordHash: await hash(BOOTSTRAP_PASSWORD, 12)
      }
    }));

  const themeResult = await prisma.theme.updateMany({
    where: { userId: null },
    data: { userId: bootstrapUser.id } as Prisma.ThemeUpdateManyMutationInput
  });

  const scenarioResult = await prisma.portfolioScenario.updateMany({
    where: { userId: null },
    data: { userId: bootstrapUser.id } as Prisma.PortfolioScenarioUpdateManyMutationInput
  });

  console.log(
    `Ensured user ${BOOTSTRAP_EMAIL}. Reowned ${themeResult.count} themes and ${scenarioResult.count} scenarios.`
  );
}

backfillOwnership()
  .catch((error) => {
    console.error("Bootstrap failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
