import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  toggleCustomerAktif,
  topupSaldo,
  getCustomerByNis,
  getCustomerFilters,
  getCustomerTemplate,
  getCustomerTemplateXlsx,
  bulkUploadCustomers,
  uploadMiddleware,
} from '../controllers/customersController';

const router = Router();

router.use(authenticate);

router.get('/template', requireRole('MANAGER'), getCustomerTemplate);
router.get('/template/xls', requireRole('MANAGER'), getCustomerTemplateXlsx);

router.post(
  '/bulk-upload',
  requireRole('MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'Ukuran file melebihi 5MB', code: 'FILE_TOO_LARGE' });
        } else {
          res.status(400).json({ error: 'File bukan CSV yang valid', code: 'INVALID_FILE' });
        }
        return;
      }
      next();
    });
  },
  bulkUploadCustomers
);

router.get('/filters', getCustomerFilters);
router.get('/by-nis/:nis', getCustomerByNis);
router.get('/', searchCustomers);
router.post('/', createCustomer);
router.put('/:id', requireRole('MANAGER'), updateCustomer);
router.patch('/:id/toggle-aktif', requireRole('MANAGER'), toggleCustomerAktif);
router.post('/:id/topup', requireRole('MANAGER'), topupSaldo);
router.delete('/:id', requireRole('MANAGER'), deleteCustomer);

export default router;
