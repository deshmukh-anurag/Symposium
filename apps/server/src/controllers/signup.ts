import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@symposium/db";
import type { Request, Response } from "express";

const SignupInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(40),
  password: z.string().min(8).max(100),
});

const handleSignup=async(req:Request,res:Response)=>{
    const parsed = SignupInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid input" });
      }
      const { email, name, password } = parsed.data;
    
      const passwordHash = await bcrypt.hash(password, 10); 
    
      try {
        const user = await prisma.user.create({
          data: { email, name, password: passwordHash },
        });
        
        res.status(201).json({ id: user.id, email: user.email, name: user.name });
      } catch {
    
        res.status(409).json({ error: "email already registered" });
      }
}
export default handleSignup;