import json from 'rollup-plugin-json'
import copy from 'rollup-plugin-copy'

export default {
  input: 'index.js',
  external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
  output: [
    {
      file: 'dist/botium-connector-nuance-es.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/botium-connector-nuance-cjs.cjs',
      format: 'cjs',
      exports: 'default',
      sourcemap: true
    }
  ],
  plugins: [
    json(),
    copy({
      targets: [
        { src: 'proto/', dest: 'dist' }
      ]
    })
  ]
}
