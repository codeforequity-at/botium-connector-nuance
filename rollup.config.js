import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'

export default {
  input: 'index.js',
  output: [
    {
      file: 'dist/botium-connector-nuance-es.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/botium-connector-nuance-cjs.js',
      format: 'cjs',
      sourcemap: true
    }
  ],
  plugins: [
    commonjs({
      exclude: 'node_modules/**'
    }),
    json(),
    babel({
      exclude: 'node_modules/**',
      runtimeHelpers: true
    })
  ]
}
