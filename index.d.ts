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

export function build(options: Options): Promise<void>

export default build
