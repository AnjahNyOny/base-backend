// routes/servicesRoutes.js
import express from "express";
import {
  handleCreateService,
  handleUpdateService,
  handleDeleteService,
  fetchServicesByPage,
} from "../controllers/servicesController.js";

const router = express.Router();

router.use((req, _res, next) => {
  if (req.method === 'PUT') {
    console.log('[servicesRoutes] middleware reached for', req.method, req.path);
  }
  next();
});

router.use((req, _res, next) => {
  if (req.method === 'PUT' && req.path === '/services') {
    console.log('[ROUTE] entering PUT /services');
  }
  next();
});
router.get("/services", fetchServicesByPage);
router.post("/services", handleCreateService);
router.put("/services", handleUpdateService);
router.delete("/services/:id", handleDeleteService);

export default router;