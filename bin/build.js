#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { build } from '@nmtjs/builder'

const { positionals: entries, values: options } = parseArgs({
  allowPositionals: true,
  options: {
    root: {
      type: 'string',
      default: process.cwd(),
    },
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

if (!['node', 'neutral'].includes(options.platform))
  throw new Error('Invalid platform')

build({
  entries,
  ...options,
})
