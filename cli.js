import { parseArgs } from 'node:util'
import { build } from '@neematajs/builder'

const { positionals: options, values: entries } = parseArgs({
  allowPositionals: true,
  options: {
    output: {
      type: 'string',
      default: './dist',
    },
    platform: {
      short: 'p',
      type: 'string',
      default: 'node',
    },
  },
})

build({
  root: process.cwd(),
  entries,
  output: options.output,
  platform: options.platform,
})
