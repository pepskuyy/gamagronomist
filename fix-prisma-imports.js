/**
 * Script untuk menambahkan import prisma singleton ke file yang 
 * sudah kehilangan import PrismaClient tapi masih menggunakan `prisma` variable
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getAllTsFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const skip = ['node_modules', '.next', '.git', 'dist', 'build'];
    if (item.isDirectory() && !skip.includes(item.name)) {
      results.push(...getAllTsFiles(fullPath));
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
      results.push(fullPath);
    }
  }
  return results;
}

const srcDir = path.join(__dirname, 'src');
const files = getAllTsFiles(srcDir);
let fixedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Case 1: file uses `prisma` but has no import for it
  const hasPrismaUsage = /\bprisma\b/.test(content);
  const hasPrismaImport = /from '@\/lib\/prisma'/.test(content) || /import prisma/.test(content);
  const hasPrismaClientImport = /from '@prisma\/client'/.test(content);
  
  // Remove orphaned `const prisma = new PrismaClient()` lines (without import)
  if (content.includes('const prisma = new PrismaClient()') && !hasPrismaClientImport) {
    content = content.replace(/^const prisma = new PrismaClient\(\)\r?\n/gm, '');
    content = content.replace(/^const prisma = new PrismaClient\(\)/gm, '');
  }
  
  // Remove PrismaClient imports that are now unused (no `new PrismaClient` left)
  if (!content.includes('new PrismaClient()') && content.includes("from '@prisma/client'")) {
    // Only remove if PrismaClient is the only import
    content = content.replace(/^import \{ PrismaClient \} from '@prisma\/client'\r?\n/gm, '');
  }
  
  // Add singleton import if prisma is used but not imported
  const hasPrismaUsageAfter = /\bprisma\b/.test(content);
  const hasPrismaImportAfter = /from '@\/lib\/prisma'/.test(content) || /from "@\/lib\/prisma"/.test(content);
  
  if (hasPrismaUsageAfter && !hasPrismaImportAfter && !content.includes('new PrismaClient()')) {
    // Add import after first line (if 'use server') or at top
    if (content.startsWith("'use server'") || content.startsWith('"use server"')) {
      content = content.replace(/^('use server'|"use server")\r?\n/, `$1\n\nimport prisma from '@/lib/prisma'\n`);
    } else {
      // Find first import line and add before it  
      content = `import prisma from '@/lib/prisma'\n` + content;
    }
    console.log(`Fixed (added import): ${file}`);
    fixedCount++;
    fs.writeFileSync(file, content, 'utf8');
    continue;
  }
  
  // Write back if changed
  const original = fs.readFileSync(file, 'utf8');
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed (cleanup): ${file}`);
    fixedCount++;
  }
}

console.log(`\nTotal fixed: ${fixedCount} files`);
