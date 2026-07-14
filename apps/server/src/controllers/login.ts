import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@symposium/db";
import { signToken } from "../lib/jwt";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const handleLogin = async (req: Request, res: Response) => {
  const parsed = LoginInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid input" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // SAME error whether the email is unknown OR the password is wrong — never reveal which
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = signToken(user.id, user.name);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
};

export default handleLogin;
