import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import swc from '@swc/core'
import glob from 'fast-glob'

/** @typedef {{root: string | URL, output: string | URL, entries: string[], platform: 'node' | 'neutral', exclude?: string[], ext?: string }} Opts */

const isRelativeImport = (val) => /^(\.|\/)/.test(val) && !/\.d\.ts$/.test(val)
const isIncluded = (value, filepath, entries) => {
  const resolved = path.resolve(path.dirname(filepath), value)
  return entries.includes(resolved)
}

const replaceImport = (item, key = 'value') => {
  item[key] = item[key].replace(/\.ts$/, '.js')
  item.raw = undefined
}

/**
 * @param {import('@swc/core').Module} ast
 * @param {string} filepath
 * @param {Opts} options
 */
function resolveExtensions(ast, filepath, options) {
  ast.body = JSON.parse(JSON.stringify(ast.body), (key, item) => {
    if (item) {
      if (
        item.type === 'ImportDeclaration' ||
        item.type === 'ExportAllDeclaration' ||
        item.type === 'ExportNamedDeclaration'
      ) {
        if (isRelativeImport(item.source.value)) {
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
  const ast = swc.parseFileSync(filepath, {
    syntax: 'typescript',
    target: 'esnext',
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
      target: 'esnext',
      experimental: { keepImportAttributes: true },
    },
  })
  return [code, map]
}

/**
 * @param {Opts} options
 */
export function build(options) {
  const root =
    options.root instanceof URL
      ? fileURLToPath(`${options.root}`)
      : path.resolve(options.root)

  const output =
    options.output instanceof URL
      ? fileURLToPath(`${options.output}`)
      : path.resolve(options.output)

  const files = glob.sync(options.entries, { cwd: root })
  const entries = files.map((file) => path.join(root, file))

  const artifacts = []

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

  console.log('Cleaning output directory:', output)

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
