#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { build } from '@neematajs/builder'

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

build({
  entries,
  ...options,
})
