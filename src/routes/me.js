const express = require("express");
const prisma = require("../db/prisma");

const router = express.Router();

router.get("/me/store", async (req, res, next) => {
  try {
    const clerkUserId = req.auth?.userId || req.headers["x-clerk-user-id"];

    if (!clerkUserId) {
      return res.status(401).json({ error: "No user id provided" });
    }

    // Ensure User exists (User.email is required in your schema)
    await prisma.user.upsert({
      where: { id: clerkUserId },
      update: {},
      create: {
        id: clerkUserId,
        email: `${clerkUserId}@orderwarden.local`,
      },
      select: { id: true },
    });

    // Find store for this user + platform
    const existing = await prisma.store.findFirst({
      where: { userId: clerkUserId, platform: "etsy" },
      select: { id: true },
    });

    if (existing) {
      return res.json({ storeId: existing.id });
    }

    // Create store
    const created = await prisma.store.create({
      data: {
        userId: clerkUserId,
        platform: "etsy",
        storeName: "My Store",
      },
      select: { id: true },
    });

    return res.json({ storeId: created.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
