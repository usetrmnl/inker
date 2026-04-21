const fs = require('fs');
const path = require('path');

const provider = process.env.DB_PROVIDER || 'postgresql';
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /datasource db \{\s*provider\s*=\s*"[^"]+"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/,
  `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`
);

if (provider === 'sqlite') {
  schema = schema.replace(/ Json\?/g, ' String?');
  schema = schema.replace(/ Json/g, ' String');
}

fs.writeFileSync(schemaPath, schema);
console.log(`Database provider set to: ${provider}`);
