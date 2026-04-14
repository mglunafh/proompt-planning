'use strict';

const COL_WIDTH = { day: 40, week: 200 };

const ROLES       = ['DEVELOPER', 'ANALYST', 'PRODUCT_OWNER', 'TESTER'];
const ROLE_LABELS = { DEVELOPER: 'Developer', ANALYST: 'Analyst', PRODUCT_OWNER: 'Product owner', TESTER: 'Tester' };

const VAC_TYPE_LABELS = { VACATION: 'Vacation', SICK_LEAVE: 'Sick leave', DAY_OFF: 'Day off' };

const TASK_TYPE_LABELS = { STORY: 'Story', FEATURE: 'Feature', FEATURE_ENABLER: 'Feature Enabler' };
const TASK_TYPE_CSS    = { STORY: 'story', FEATURE: 'feature', FEATURE_ENABLER: 'feature-enabler' };
