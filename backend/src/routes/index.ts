import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { clinicRouter } from '../modules/clinic-settings/clinic.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { receptionRouter } from '../modules/reception/reception.routes.js';
import { doctorRouter } from '../modules/clinical/clinical.routes.js';
import { pharmacyRouter } from '../modules/pharmacy/pharmacy.routes.js';
import { proceduresRouter } from '../modules/procedures/procedure.routes.js';
import { accountsRouter } from '../modules/accounts/accounts.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/clinic', clinicRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/reception', receptionRouter);
apiRouter.use('/doctor', doctorRouter);
apiRouter.use('/pharmacy', pharmacyRouter);
apiRouter.use('/procedures', proceduresRouter);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/dashboard', dashboardRouter);
