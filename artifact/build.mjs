// Bundle the Claude page into one self-contained HTML file.
//   node artifact/build.mjs [out.html]
// React loads from cdnjs (the page's allowed script host); everything else,
// including the app's CSS, is inlined.
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(process.argv[2] || path.join(root, 'artifact/dist/tripsplit.html'))

// `import … from 'react'` → the UMD globals the page loads first
const globals = {
  name: 'umd-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, args => ({ path: args.path, namespace: 'umd' }))
    b.onLoad({ filter: /.*/, namespace: 'umd' }, args => ({
      contents: `module.exports = window.${args.path.startsWith('react-dom') ? 'ReactDOM' : 'React'}`,
      loader: 'js',
    }))
  },
}

const result = await build({
  entryPoints: [path.join(root, 'artifact/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  target: 'es2020',
  loader: { '.js': 'jsx' },
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  define: { 'process.env.NODE_ENV': '"production"' },
  logOverride: { 'unsupported-directive': 'silent' }, // 'use client'
  plugins: [globals],
})

const js = result.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')
const css = await readFile(path.join(root, 'app/globals.css'), 'utf8')

const html = `<title>TripSplit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`

await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, html)
console.log(`${path.relative(process.cwd(), out)}  ${(html.length / 1024).toFixed(0)} KB`)
