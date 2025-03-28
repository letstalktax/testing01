#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('Running dependency fix script...');

// Function to ensure directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Ensure components/ui directory exists
ensureDirectoryExists(path.join(process.cwd(), 'components', 'ui'));

// Check if Badge component exists, create if not
const badgePath = path.join(process.cwd(), 'components', 'ui', 'badge.tsx');
if (!fs.existsSync(badgePath)) {
  const badgeContent = `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }`;
  
  fs.writeFileSync(badgePath, badgeContent);
  console.log(`Created badge component at: ${badgePath}`);
}

// Fix Tabs component if needed
const tabsPath = path.join(process.cwd(), 'components', 'ui', 'tabs.tsx');
if (fs.existsSync(tabsPath)) {
  let tabsContent = fs.readFileSync(tabsPath, 'utf8');
  if (tabsContent.includes('@radix-ui/tabs') && !tabsContent.includes('@radix-ui/react-tabs')) {
    tabsContent = tabsContent.replace('@radix-ui/tabs', '@radix-ui/react-tabs');
    fs.writeFileSync(tabsPath, tabsContent);
    console.log('Fixed tabs component imports');
  }
}

// Fix PDF.js worker in parse-pdf route if needed
const pdfRoutePath = path.join(process.cwd(), 'app', 'api', 'admin', 'parse-pdf', 'route.ts');
if (fs.existsSync(pdfRoutePath)) {
  let pdfRouteContent = fs.readFileSync(pdfRoutePath, 'utf8');
  if (pdfRouteContent.includes('pdfjs-dist/build/pdf.worker.entry')) {
    pdfRouteContent = pdfRouteContent.replace(
      "const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');\npdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;",
      "pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;"
    );
    fs.writeFileSync(pdfRoutePath, pdfRouteContent);
    console.log('Fixed PDF.js worker in parse-pdf route');
  }
}

console.log('Dependency fix script completed.'); 