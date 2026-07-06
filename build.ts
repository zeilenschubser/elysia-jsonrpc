import { $, build } from 'bun'
import pack from './package.json'

await $`rm -rf dist`

const patchTypes = async (filename: string) => {
  let data = await Bun.file(filename).text();
  const startSection = ` status: <const Code extends number`;
  const endSection = ` }[Code] : Code>;`;
  const replacement = ' status: StatusCodes;';

  let result = '';
  let cursor = 0;

  while (cursor < data.length) {
    const startIndex = data.indexOf(startSection, cursor);
    if (startIndex === -1) {
      result += data.slice(cursor);
      break;
    }

    const endIndex = data.indexOf(endSection, startIndex);
    if (endIndex === -1) {
      result += data.slice(cursor);
      break;
    }

    result += data.slice(cursor, startIndex) + replacement;
    cursor = endIndex + endSection.length;
  }

  await Bun.write(filename, result);
};

await Promise.all([
  build({
    format: 'esm',
    minify: { identifiers: true, keepNames: false, syntax: true, whitespace: true },
    drop: ['debugger', 'console'],
    entrypoints: ['src/index.ts', 'src/mcp.types.ts', 'src/rpc.types.ts'],
    outdir: './dist',
    external: Object.keys(pack.dependencies).concat(['@elysiajs/eden']),
    // naming: { entry: 'index.js' }
  }),
  $`tsc --project tsconfig.dts.json`.then(async (x) => {
    await patchTypes('dist/index.d.ts')
  }),
])
process.exit()
