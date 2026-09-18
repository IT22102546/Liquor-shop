import { prisma } from "../../database/prisma.client";
import { Prisma } from "../../generated/prisma";
import { AppError } from "../../common/utils/errors";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateContactRequestDto {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  interests?: string;
  message?: string;
}

export interface UpdateContactRequestDto {
  status?: string;
  notes?: string;
}

export interface ListContactRequestsOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

// ── Display ID ─────────────────────────────────────────────────────────────

async function generateDisplayId(): Promise<string> {
  const latest = await prisma.contactRequest.findFirst({
    orderBy: { id: "desc" },
    select: { displayId: true },
  });
  const current = latest?.displayId
    ? Number.parseInt(latest.displayId.replace(/^CR-/, ""), 10)
    : 0;
  return `CR-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}

async function createWithUniqueDisplayId(data: {
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  interests: string;
  message?: string | null;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const displayId = await generateDisplayId();
    try {
      return await prisma.contactRequest.create({
        data: { ...data, displayId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(err.meta?.target ?? "").includes("displayId")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new AppError("Failed to generate unique display ID", 500);
}

// ── Public ─────────────────────────────────────────────────────────────────

export async function createContactRequest(dto: CreateContactRequestDto) {
  return createWithUniqueDisplayId({
    name: dto.name.trim(),
    email: dto.email.trim().toLowerCase(),
    phone: dto.phone?.trim() ?? null,
    city: dto.city?.trim() ?? null,
    interests: dto.interests?.trim() ?? "",
    message: dto.message?.trim() ?? null,
  });
}

// ── POS Admin ──────────────────────────────────────────────────────────────

export async function listContactRequests(opts: ListContactRequestsOptions) {
  const { page, limit, search, status } = opts;
  const skip = (page - 1) * limit;

  const where: Prisma.ContactRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { displayId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contactRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.contactRequest.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getContactRequest(id: number) {
  const record = await prisma.contactRequest.findUnique({ where: { id } });
  if (!record) throw new AppError("Contact request not found", 404);
  return record;
}

export async function updateContactRequest(
  id: number,
  dto: UpdateContactRequestDto,
) {
  const exists = await prisma.contactRequest.findUnique({ where: { id } });
  if (!exists) throw new AppError("Contact request not found", 404);

  const allowed = ["new", "contacted", "closed"];
  if (dto.status && !allowed.includes(dto.status)) {
    throw new AppError(`Invalid status. Allowed: ${allowed.join(", ")}`, 400);
  }

  return prisma.contactRequest.update({
    where: { id },
    data: {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    },
  });
}

export async function deleteContactRequest(id: number) {
  const exists = await prisma.contactRequest.findUnique({ where: { id } });
  if (!exists) throw new AppError("Contact request not found", 404);
  await prisma.contactRequest.delete({ where: { id } });
}

export async function getContactRequestStats() {
  const [total, newCount, contacted, closed] = await Promise.all([
    prisma.contactRequest.count(),
    prisma.contactRequest.count({ where: { status: "new" } }),
    prisma.contactRequest.count({ where: { status: "contacted" } }),
    prisma.contactRequest.count({ where: { status: "closed" } }),
  ]);
  return { total, new: newCount, contacted, closed };
}
