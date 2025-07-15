import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');

  if (!shop) {
    return json({ error: "Shop parameter is missing" }, { status: 400 });
  }

  const settings = await prisma.quickViewCss.findUnique({
    where: { shop },
    select: { css: true }
  });

  return json(
    { css: settings?.css || "" },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}; 