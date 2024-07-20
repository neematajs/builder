import fsp from 'node:fs/promises'

/**
 * @returns {import('esbuild').Plugin}
 */
export default (options) => ({
  name: 'fix-extensions',
  setup(build) {
    build.onLoad({ filter: /.*/ }, async (args) => {
      if (args.namespace === 'file') {
        const contents = await fsp.readFile(args.path, {
          encoding: 'utf-8',
        })
        const newContents = contents.replace(
          /(import )(.*)(from '\.\/)(.*)(\.ts')/gm,
          "$1$2$3$4.js'",
        )
        return { contents: newContents, loader: 'ts' }
      }
      return {}
    })
  },
})