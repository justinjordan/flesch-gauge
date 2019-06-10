import svelte from 'rollup-plugin-svelte';
import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import json from 'rollup-plugin-json';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [{
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'esm',
		name: 'app',
		file: 'dist/flesch-gauge.js'
	},
	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
			// css: css => {
			// 	css.write('dist/flesch-gauge.css');
			// }
    }),

    json({
      include: 'node_modules/**',
      preferConst: true,
      compact: true,
    }),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve(),
		commonjs(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('dist'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),

		babel({
			exclude: 'node_modules/**',
		}),
	],
	watch: {
		clearScreen: false
	}
}, {
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'dist/flesch-gauge.iife.js'
	},
	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
			// css: css => {
			// 	css.write('dist/flesch-gauge.css');
			// }
    }),

    json({
      include: 'node_modules/**',
      preferConst: true,
      compact: true,
    }),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve(),
		commonjs(),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),
		production && babel({
			exclude: 'node_modules/**',
		}),
	],
	watch: {
		clearScreen: false
	}
}];