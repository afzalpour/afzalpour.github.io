'use strict';

import { installTaxWorkspace } from './src/ui/tax/tax-workspace.js';
import { installTaxSettingsSingleton } from './src/ui/tax/tax-settings-singleton.js';

installTaxWorkspace();
installTaxSettingsSingleton();
