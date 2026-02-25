import { Request, Response } from "express";
import { prisma } from "../prisma";
import type { Contact } from "@prisma/client";

export const identify = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body as {
      email?: string;
      phoneNumber?: string;
    };

    if (!email && !phoneNumber) {
      return res.status(400).json({
        message: "Either email or phoneNumber must be provided",
      });
    }

    // 1️⃣ Find initial matches
    const matchedContacts: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { createdAt: "asc" },
    });

    // 2️⃣ If no match → create primary
    if (matchedContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });

      return res.json({
        contact: {
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // 3️⃣ Get all involved contact IDs (cluster expansion)
    const contactIds = new Set<number>();

    matchedContacts.forEach((c) => {
      contactIds.add(c.id);
      if (c.linkedId) contactIds.add(c.linkedId);
    });

    const clusterContacts: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          { id: { in: Array.from(contactIds) } },
          { linkedId: { in: Array.from(contactIds) } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // 4️⃣ Determine oldest primary
    const primaryCandidates = clusterContacts.filter(
      (c) => c.linkPrecedence === "primary"
    );

    const oldestPrimary =
      primaryCandidates.length > 0
        ? primaryCandidates.reduce((oldest, current) =>
            current.createdAt < oldest.createdAt ? current : oldest
          )
        : clusterContacts[0];

    // 5️⃣ Convert other primaries to secondary
    for (const contact of clusterContacts) {
      if (
        contact.linkPrecedence === "primary" &&
        contact.id !== oldestPrimary.id
      ) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkPrecedence: "secondary",
            linkedId: oldestPrimary.id,
          },
        });
      }

      if (
        contact.linkPrecedence === "secondary" &&
        contact.linkedId !== oldestPrimary.id
      ) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkedId: oldestPrimary.id,
          },
        });
      }
    }

    // 6️⃣ Refresh cluster after updates
    const finalCluster: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          { id: oldestPrimary.id },
          { linkedId: oldestPrimary.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // 7️⃣ Check if new secondary needed
    const emailExists = email
      ? finalCluster.some((c) => c.email === email)
      : true;

    const phoneExists = phoneNumber
      ? finalCluster.some((c) => c.phoneNumber === phoneNumber)
      : true;

    if (!emailExists || !phoneExists) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: oldestPrimary.id,
          linkPrecedence: "secondary",
        },
      });
    }

    // 8️⃣ Final fetch after possible insert
    const completeCluster: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          { id: oldestPrimary.id },
          { linkedId: oldestPrimary.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const emails = Array.from(
      new Set(
        completeCluster
          .map((c) => c.email)
          .filter((v): v is string => Boolean(v))
      )
    );

    const phoneNumbers = Array.from(
      new Set(
        completeCluster
          .map((c) => c.phoneNumber)
          .filter((v): v is string => Boolean(v))
      )
    );

    const secondaryContactIds = completeCluster
      .filter((c) => c.linkPrecedence === "secondary")
      .map((c) => c.id);

    return res.json({
      contact: {
        primaryContactId: oldestPrimary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error("Identify Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};