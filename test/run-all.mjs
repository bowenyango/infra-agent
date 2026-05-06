import { runCategory } from './run-category.mjs';

await runCategory('unit');
await runCategory('integration');
await runCategory('contract');
