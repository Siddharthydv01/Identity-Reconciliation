import { prisma } from "../prisma";
import type { Contact } from "@prisma/client";

interface IdentifyInput {
    email?: string;
    phoneNumber?: string;
}

export const identifyService = async ({
    email,
    phoneNumber,
}: IdentifyInput) => {
    if (!email && !phoneNumber) {
        throw new Error("INVALID_INPUT");
    }

    return await prisma.$transaction(async (tx) => {
        // 1️⃣ Find matching contacts
        const matchedContacts: Contact[] = await tx.contact.findMany({
            where: {
                OR: [
                    email ? { email } : undefined,
                    phoneNumber ? { phoneNumber } : undefined,
                ].filter(Boolean) as any,
            },
            orderBy: { createdAt: "asc" },
        });

        // 2️⃣ No match → create primary
        if (matchedContacts.length === 0) {
            const newContact = await tx.contact.create({
                data: {
                    ...(email && { email }),
                    ...(phoneNumber && { phoneNumber }),
                    linkPrecedence: "primary",
                },
            });

            return {
                contact: {
                    primaryContactId: newContact.id,
                    emails: email ? [email] : [],
                    phoneNumbers: phoneNumber ? [phoneNumber] : [],
                    secondaryContactIds: [],
                },
            };
        }

        // 3️⃣ Expand cluster
        const contactIds = new Set<number>();

        matchedContacts.forEach((c) => {
            contactIds.add(c.id);
            if (c.linkedId) contactIds.add(c.linkedId);
        });

        const clusterContacts: Contact[] = await tx.contact.findMany({
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

        // 4️⃣ Determine oldest contact in cluster
        const oldestPrimary: Contact = clusterContacts.reduce((oldest, current) =>
            current.createdAt < oldest.createdAt ? current : oldest
        );

        // 5️⃣ Normalize cluster
        for (const contact of clusterContacts) {
            if (
                contact.linkPrecedence === "primary" &&
                contact.id !== oldestPrimary.id
            ) {
                await tx.contact.update({
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
                await tx.contact.update({
                    where: { id: contact.id },
                    data: { linkedId: oldestPrimary.id },
                });
            }
        }

        // 6️⃣ Fetch updated cluster
        const finalCluster: Contact[] = await tx.contact.findMany({
            where: {
                OR: [
                    { id: oldestPrimary.id },
                    { linkedId: oldestPrimary.id },
                ],
            },
            orderBy: { createdAt: "asc" },
        });

        // 7️⃣ Insert new secondary if needed
        const emailExists = email
            ? finalCluster.some((c) => c.email === email)
            : true;

        const phoneExists = phoneNumber
            ? finalCluster.some((c) => c.phoneNumber === phoneNumber)
            : true;

        if (!emailExists || !phoneExists) {
            await tx.contact.create({
                data: {
                    ...(email && { email }),
                    ...(phoneNumber && { phoneNumber }),
                    linkedId: oldestPrimary.id,
                    linkPrecedence: "secondary",
                },
            });
        }

        // 8️⃣ Final fetch
        const completeCluster: Contact[] = await tx.contact.findMany({
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

        return {
            contact: {
                primaryContactId: oldestPrimary.id,
                emails,
                phoneNumbers,
                secondaryContactIds,
            },
        };
    });
};