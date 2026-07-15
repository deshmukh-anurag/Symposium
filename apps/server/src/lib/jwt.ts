import jwt from "jsonwebtoken";

const SECRET: string = process.env.JWT_SECRET ?? "";
if (!SECRET) throw new Error("JWT_SECRET is not set");


export type TokenPayload = { sub: string; name: string };

export function signToken(userId: string, name: string): string {
  return jwt.sign({ sub: userId, name }, SECRET, { expiresIn: 60 * 60 * 24 * 7 });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload; }
