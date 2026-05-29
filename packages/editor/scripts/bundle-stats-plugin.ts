import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'
import type { Plugin as RolldownPlugin } from 'rolldown'

type StatsCtx = { info?: (m: string) => void; warn?: (m: string) => void }

// Walks the static-import graph from the entry, gzips each chunk individually,
// and writes dist/bundle-stats.json. The marketing site fetches this from
// unpkg at build time to render the bundle-size pill with honest numbers
// (initial static bundle vs. lazy chunks). Static walk stops at dynamic
// import() boundaries — that's the whole point: report what a real consumer's
// bundler will inline up-front, not a bundlejs-style overcount.
function writeBundleStats(
  opts: { distDir: string; entry: string; pkgVersion: string; generatedAt: string },
  ctx: StatsCtx,
): void {
  try {
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
      generatedAt: opts.generatedAt,
    }
    writeFileSync(
      join(opts.distDir, 'bundle-stats.json'),
      JSON.stringify(stats, null, 2),
    )
    ctx.info?.(
      `bundle-stats.json: initial ${(initialGzip / 1024).toFixed(1)} kB gz / ${visited.size} files, lazy ${(lazyGzip / 1024).toFixed(1)} kB gz / ${lazyCount} files`,
    )
  } catch (err) {
    // Stats are observability output, not a build artifact consumers need.
    // If dist layout shifts or the entry walk fails, warn and let the build
    // continue rather than failing CI on a reporting plugin.
    const message = err instanceof Error ? err.message : String(err)
    ctx.warn?.(`bundle-stats: skipped (${message})`)
  }
}

export function bundleStatsPlugin(opts: {
  distDir: string
  entry: string
  pkgVersion: string
}): Plugin {
  return {
    name: 'tpl-bundle-stats',
    apply: 'build',
    closeBundle() {
      writeBundleStats({ ...opts, generatedAt: new Date().toISOString() }, this)
    },
  }
}

/** tsdown/Rolldown variant — always build mode, so no Vite `apply` field. */
export function bundleStatsRolldownPlugin(opts: {
  distDir: string
  entry: string
  pkgVersion: string
}): RolldownPlugin {
  return {
    name: 'tpl-bundle-stats',
    closeBundle() {
      writeBundleStats({ ...opts, generatedAt: new Date().toISOString() }, this as never)
    },
  } as RolldownPlugin
}
