import typescript from 'rollup-plugin-typescript2'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'
import json from '@rollup/plugin-json'
import image from '@rollup/plugin-image'
import gzipPlugin from 'rollup-plugin-gzip'
import copy from 'rollup-plugin-copy'

export default [
  {
    input: 'src/hass-weather-card.ts',
    output: {
      file: 'dist/hass-weather-card.js',
      format: 'es',
    },
    plugins: [
      image(),
      nodeResolve(),
      commonjs(),
      typescript(),
      json(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled'
      }),
      terser(),
      gzipPlugin(),
      copy({
        targets: [
          { src: 'node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', dest: 'dist' }
        ]
      })
    ],
    onwarn(warning, warn) {
      if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message.includes('/luxon/')) {
        // https://github.com/moment/luxon/issues/193
        return;
      } else if (warning.code === 'THIS_IS_UNDEFINED' && warning.id.includes('@formatjs')) {
        // https://github.com/custom-cards/custom-card-helpers/issues/64
        return
      }
      warn(warning);
    },
  },
];
