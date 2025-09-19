// routes/robotsRoutes.js
import express from "express";
const router = express.Router();

router.get("/robots.txt", (req, res) => {
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  const body =
`User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
  res.type("text/plain; charset=UTF-8").send(body);
});

export default router;
