const fs = require('fs');

// Read the file
const filePath = 'src/routes/records.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Pattern to match: objectName.user.username
// Replace with: getUserDisplayName(objectName.user)
const pattern = /(\w+)\.user\.username/g;
content = content.replace(pattern, 'getUserDisplayName($1.user)');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed username references in records.ts');
