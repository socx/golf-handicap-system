const { loadEnvFromRoot } = require('../../../../scripts/db/load-env');
import { validateAndNormalizeEnv } from './validate-env';

loadEnvFromRoot();

export const env = validateAndNormalizeEnv(process.env);
