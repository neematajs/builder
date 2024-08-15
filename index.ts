import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import swc from '@swc/wasm'
import type { Module } from '@swc/wasm'
import { globSync } from 'glob'

export type Options = {
  root: string | URL
  output: string | URL
  entries: string[]
  platform: 'node' | 'neutral'
  exclude?: string[]
  ext?: string
}

export type Artifact = {
  filepath: string
  contents?: string | null
  sourceMap?: string | null
}

const isRelativeImport = (val) => /^(\.|\/)/.test(val) && !/\.d\.ts$/.test(val)
const isIncluded = (value, filepath, entries) => {
  const resolved = path.resolve(path.dirname(filepath), value)
  return entries.includes(resolved)
}

const replaceImport = (item, key = 'value') => {
  item[key] = item[key].replace(/\.ts$/, '.js')
  item.raw = undefined
}

function resolveExtensions(ast: Module, filepath: string, options: Options) {
  ast.body = JSON.parse(JSON.stringify(ast.body), (key, item) => {
    if (item) {
      if (
        item.type === 'ImportDeclaration' ||
        item.type === 'ExportAllDeclaration' ||
        item.type === 'ExportNamedDeclaration'
      ) {
        if (item.source && isRelativeImport(item.source.value)) {
          if (isIncluded(item.source.value, filepath, options.entries)) {
            replaceImport(item.source)
          }
        }
      } else if (
        item.type === 'CallExpression' &&
        item.callee.type === 'Import'
      ) {
        if (item.arguments?.length === 1) {
          let expr = item.arguments[0].expression

          if (
            expr.type === 'TemplateLiteral' &&
            expr.quasis.length === 1 &&
            expr.quasis[0].cooked
          ) {
            expr = expr.quasis[0]
            if (
              isRelativeImport(expr.cooked) &&
              isIncluded(expr.cooked, filepath, options.entries)
            ) {
              replaceImport(expr, 'cooked')
              expr.raw = expr.cooked
            }
          } else if (
            expr.type === 'StringLiteral' &&
            isRelativeImport(expr.value) &&
            isIncluded(expr.value, filepath, options.entries)
          ) {
            replaceImport(expr)
          }
        }
      }
    }
    return item
  })
}

function transform({ filepath, options }) {
  const src = fs.readFileSync(filepath, 'utf8')
  const ast = swc.parseSync(src, {
    syntax: 'typescript',
    target: 'es2022',
  })
  resolveExtensions(ast, filepath, options)
  const { code, map } = swc.transformSync(ast, {
    sourceFileName: path.relative(
      path.join(options.output, path.relative(options.root, filepath)),
      filepath,
    ),
    filename: filepath,
    sourceMaps: true,
    module: { type: options.platform === 'node' ? 'nodenext' : 'es6' },
    jsc: {
      keepClassNames: true,
      parser: { syntax: 'typescript' },
      target: 'es2022',
    },
  })
  return [code, map]
}

export function build(options: Options) {
  const root =
    options.root instanceof URL
      ? fileURLToPath(`${options.root}`)
      : path.resolve(options.root)

  const output =
    options.output instanceof URL
      ? fileURLToPath(`${options.output}`)
      : path.resolve(options.output)

  const files = globSync(options.entries, { cwd: root })
  const entries = files.map((file) => path.join(root, file))

  const artifacts: Artifact[] = []

  console.log('Starting build...')

  $f: for (const filepath of files) {
    for (const ext of [...(options.ext ?? []), '.d.ts', '.d.cts', '.d.mts']) {
      if (filepath.endsWith(ext)) {
        artifacts.push({
          filepath,
          contents: null,
          sourceMap: null,
        })
        continue $f
      }
    }

    const [contents, sourceMap] = transform({
      filepath: path.join(root, filepath),
      options: {
        ...options,
        entries,
        root,
        output,
      },
    })

    artifacts.push({
      filepath: filepath.replace(/\.ts$/, options.ext ?? '.js'),
      contents,
      sourceMap,
    })
  }

  console.log('Cleaning output directory:', path.relative(root, output))

  fs.rmSync(options.output, { recursive: true, force: true })

  for (const { filepath, contents, sourceMap } of artifacts) {
    const source = path.resolve(root, filepath)
    const target = path.resolve(output, filepath)

    fs.mkdirSync(path.dirname(target), { recursive: true })

    console.log('Emitting:', filepath)
    if (contents) fs.writeFileSync(target, contents)
    else fs.copyFileSync(source, target)

    if (sourceMap) {
      console.log('Emitting:', `${filepath}.map`)
      fs.writeFileSync(`${target}.map`, sourceMap)
    }
  }

  console.log('Build completed!')
}

export default build
