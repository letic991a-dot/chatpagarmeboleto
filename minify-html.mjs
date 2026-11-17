import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  cp
} from "node:fs/promises";

import { join, relative, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "html-minifier-terser";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(ROOT, "dist");

const IGNORED_DIRECTORIES = new Set([
  "dist",
  "node_modules",
  ".git",
  ".github",
  ".cache",
  "coverage",
  ".vite"
]);

async function findProjectFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await findProjectFiles(entryPath, files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function minifyHtmlFile(sourcePath, destinationPath) {
  const html = await readFile(sourcePath, "utf8");

  const result = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true
  });

  await mkdir(dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, result, "utf8");

  console.log(
    `HTML minificado: ${relative(ROOT, sourcePath)} -> ${relative(ROOT, destinationPath)} ` +
    `(${html.length} -> ${result.length} bytes)`
  );
}

async function main() {
  await rm(DIST, {
    recursive: true,
    force: true
  });

  await mkdir(DIST, {
    recursive: true
  });

  const projectFiles = await findProjectFiles(ROOT);
  const htmlFiles = projectFiles.filter(
    (file) => [".html", ".htm"].includes(extname(file).toLowerCase())
  );

  if (htmlFiles.length === 0) {
    throw new Error("Nenhum arquivo HTML foi encontrado no projeto.");
  }

  for (const sourcePath of htmlFiles) {
    const relativePath = relative(ROOT, sourcePath);
    const destinationPath = join(DIST, relativePath);

    await minifyHtmlFile(sourcePath, destinationPath);
  }

  // Garante que o servidor encontre o index na raiz de dist.
  const indexFile = htmlFiles.find(
    (file) => basename(file).toLowerCase() === "index.html"
  );

  if (indexFile) {
    const relativeIndex = relative(ROOT, indexFile);
    const generatedIndex = join(DIST, "index.html");

    if (relativeIndex !== "index.html") {
      await cp(join(DIST, relativeIndex), generatedIndex);
    }
  }

  // Garante que o servidor encontre o painel em dist/admin.html.
  const adminFile = htmlFiles.find(
    (file) => basename(file).toLowerCase() === "admin.html"
  );

  if (adminFile) {
    const relativeAdmin = relative(ROOT, adminFile);
    const generatedAdmin = join(DIST, "admin.html");

    if (relativeAdmin !== "admin.html") {
      await cp(join(DIST, relativeAdmin), generatedAdmin);
    }
  }

  console.log(`Build concluído. ${htmlFiles.length} arquivo(s) HTML processado(s).`);
}

main().catch((error) => {
  console.error("Erro no build:", error);
  process.exit(1);
});
