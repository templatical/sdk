import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

// Walks the static-import graph from the entry, gzips each chunk individually,
// and writes dist/bundle-stats.json. The marketing site fetches this from
// unpkg at build time to render the bundle-size pill with honest numbers
// (initial static bundle vs. lazy chunks). Static walk stops at dynamic
// import() boundaries — that's the whole point: report what a real consumer's
// bundler will inline up-front, not a bundlejs-style overcount.
export function bundleStatsPlugin(opts: {
  distDir: string
  entry: string
  pkgVersion: string
}): Plugin {
  return {
    name: 'tpl-bundle-stats',
    apply: 'build',
    closeBundle() {
      const visited = new Set<string>()
      let initialRaw = 0
      let initialGzip = 0

      const STATIC_IMPORT_RE =
        /(?:^|[\s;])(?:import|export)[^;]*?from\s*["']\.\/([^"']+)["']/g

      const walk = (relFromDist: string) => {
        if (visited.has(relFromDist)) return
        visited.add(relFromDist)
        const raw = readFileSync(join(opts.distDir, relFromDist))
        initialRaw += raw.byteLength
        initialGzip += gzipSync(raw).byteLength
        const text = raw.toString('utf8')
        STATIC_IMPORT_RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = STATIC_IMPORT_RE.exec(text))) walk(m[1])
      }

      walk(opts.entry)

      let lazyRaw = 0
      let lazyGzip = 0
      let lazyCount = 0
      for (const f of readdirSync(opts.distDir)) {
        if (!f.endsWith('.js')) continue
        if (visited.has(f)) continue
        const raw = readFileSync(join(opts.distDir, f))
        lazyRaw += raw.byteLength
        lazyGzip += gzipSync(raw).byteLength
        lazyCount++
      }

      const stats = {
        version: opts.pkgVersion,
        initialGzipBytes: initialGzip,
        initialRawBytes: initialRaw,
        initialFileCount: visited.size,
        lazyGzipBytes: lazyGzip,
        lazyRawBytes: lazyRaw,
        lazyFileCount: lazyCount,
        generatedAt: new Date().toISOString(),
      }
      writeFileSync(
        join(opts.distDir, 'bundle-stats.json'),
        JSON.stringify(stats, null, 2),
      )
      this.info?.(
        `bundle-stats.json: initial ${(initialGzip / 1024).toFixed(1)} kB gz / ${visited.size} files, lazy ${(lazyGzip / 1024).toFixed(1)} kB gz / ${lazyCount} files`,
      )
    },
  }
}
