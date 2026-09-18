import type { Role } from "../../generated/prisma";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: Role;
    }
    interface Request {
      user?: User;
    }
  }
}

export {};
