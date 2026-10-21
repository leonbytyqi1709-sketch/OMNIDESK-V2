import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
const root = resolve(import.meta.dirname, '..'),
  out = resolve(root, 'dist-browser-extension')
const files = [
  'manifest.json',
  'background.js',
  'panel.html',
  'panel.css',
  'panel.js',
].map((name) => ({
  name,
  data: readFileSync(resolve(root, 'browser-extension', name)),
}))
files.push({
  name: 'source-url.js',
  data: Buffer.from(
    transformSync(
      readFileSync(resolve(root, 'src/lib/browser-url.ts'), 'utf8'),
      { loader: 'ts', format: 'esm', target: 'chrome116' },
    ).code,
  ),
})
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (data) => {
  let crc = 0xffffffff
  for (const b of data) crc = table[(crc ^ b) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
const local = [],
  central = []
let offset = 0
for (const { name, data } of files) {
  writeFileSync(resolve(out, name), data)
  const n = Buffer.from(name),
    crc = crc32(data),
    l = Buffer.alloc(30)
  l.writeUInt32LE(0x04034b50)
  l.writeUInt16LE(20, 4)
  l.writeUInt16LE(0x800, 6)
  l.writeUInt16LE(0x21, 12)
  l.writeUInt32LE(crc, 14)
  l.writeUInt32LE(data.length, 18)
  l.writeUInt32LE(data.length, 22)
  l.writeUInt16LE(n.length, 26)
  local.push(l, n, data)
  const c = Buffer.alloc(46)
  c.writeUInt32LE(0x02014b50)
  c.writeUInt16LE(20, 4)
  c.writeUInt16LE(20, 6)
  c.writeUInt16LE(0x800, 8)
  c.writeUInt16LE(0x21, 14)
  c.writeUInt32LE(crc, 16)
  c.writeUInt32LE(data.length, 20)
  c.writeUInt32LE(data.length, 24)
  c.writeUInt16LE(n.length, 28)
  c.writeUInt32LE(offset, 42)
  central.push(c, n)
  offset += l.length + n.length + data.length
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(directory.length, 12)
end.writeUInt32LE(offset, 16)
mkdirSync(resolve(root, 'public/downloads'), { recursive: true })
writeFileSync(
  resolve(root, 'public/downloads/omnidesk-browser.zip'),
  Buffer.concat([...local, directory, end]),
)
console.log(
  `Browser extension: ${files.length} explicit files, dist-browser-extension and public/downloads/omnidesk-browser.zip`,
)
