const fs = require('fs');
const path = require('path');
const dtsPath = path.join(__dirname, '../node_modules/.prisma/client/index.d.ts');
if (fs.existsSync(dtsPath)) {
  let dts = fs.readFileSync(dtsPath, 'utf8');
  const fields = ['config', 'headers', 'lastData', 'metadata', 'defaultConfig', 'dataHeaders', 'settingsSchema', 'settings', 'settingsEncrypted'];
  fields.forEach(field => {
    // Replace simple "field: string" or "field?: string" or "field: string | null"
    dts = dts.replace(new RegExp(`(\\b${field}\\s*\\??\\s*:)\\s*string(\\s*\\|\\s*null)?(?=[\\n\\r;,])`, 'g'), `$1 any`);
    
    // Replace "field?: NullableStringFieldUpdateOperationsInput | string | null"
    dts = dts.replace(new RegExp(`(\\b${field}\\s*\\??\\s*:)\\s*[a-zA-Z<>\\"_]+\\s*\\|\\s*string\\s*\\|\\s*null(?=[\\n\\r;,])`, 'g'), `$1 any`);
    
    // Replace "field?: StringFieldUpdateOperationsInput | string"
    dts = dts.replace(new RegExp(`(\\b${field}\\s*\\??\\s*:)\\s*[a-zA-Z<>\\"_]+\\s*\\|\\s*string(?=[\\n\\r;,])`, 'g'), `$1 any`);
  });
  
  // replace Prisma.DbNull
  dts = dts.replace(/Prisma\.DbNull/g, 'any');
  
  fs.writeFileSync(dtsPath, dts);
  console.log('Fixed Prisma TS types for SQLite');
}
