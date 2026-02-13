const fs = require('fs');

// Read the file
const filePath = 'src/routes/records.ts';
let content = fs.readFileSync(filePath, 'utf8');

// First, revert any bad replacements
// Pattern: objectName.getUserDisplayName(something) -> objectName.something.username
content = content.replace(/(\w+)\.getUserDisplayName\((\w+)\.user\)/g, '$1.$2.user.username');

// Now do the correct replacement
// Pattern: objectName.propertyPath.user.username -> getUserDisplayName(objectName.propertyPath.user)
// This handles cases like: fastestVictory.robot1.user.username
content = content.replace(/(\w+(?:\.\w+)*)\.user\.username/g, 'getUserDisplayName($1.user)');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed username references in records.ts');
