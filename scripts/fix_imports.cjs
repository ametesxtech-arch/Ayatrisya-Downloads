const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      fixImports(full);
    } else if (entry.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      content = content.replace(/from\s+["'](\.[^"']+)["']/g, (match, p1) => {
        if (!p1.endsWith('.js') && !p1.endsWith('.json')) {
          return 'from "' + p1 + '.js"';
        }
        return match;
      });
      content = content.replace(/\(r,\s*i\)\s*=>/g, '(r: any, i: number) =>');
      content = content.replace(/\(x\)\s*=>/g, '(x: any) =>');
      content = content.replace(/\(c\)\s*=>/g, '(c: any) =>');
      content = content.replace(/\(q\)\s*=>/g, '(q: any) =>');
      content = content.replace(/\(b\)\s*=>/g, '(b: any) =>');
      fs.writeFileSync(full, content, 'utf8');
    }
  }
}

fixImports('repos/Ayatrisya-Model/src/lib/orchestrator');
fixImports('repos/Ayatrisya-Model/src/lib/response-protocol');
fixImports('repos/Ayatrisya-Model/src/lib/assessment-engine');
console.log('Successfully fixed imports and implicit any types.');

