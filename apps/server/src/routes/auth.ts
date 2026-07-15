import { Router } from "express";
import handleSignup from "../controllers/signup";
import handleLogin from "../controllers/login";

const router = Router();
router.post("/signup", handleSignup); // mounted at "/auth" below → real URL is POST /auth/signup
router.post("/login", handleLogin);

export default router;
