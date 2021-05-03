import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript';
import globals from 'rollup-plugin-node-globals';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import builtins from 'rollup-plugin-node-builtins';

// Rollup config for minified production builds

const config = (output, babelConf) => ({
	input: 'src/csf.ts',
	output,
	onwarn(warning) {
		console.error(`(!) ${warning.message}`);
	},
	plugins: [
        nodePolyfills(),
		typescript(),
		resolve({ preferBuiltins: false }),
		commonjs(),
		babel(babelConf),
		terser({
			warnings: true,
			mangle: {
				module: true,
			},
		}),
        nodePolyfills(),
        globals(),
	],
	external: builtins,

});

export default [
	config(
		{
			file: 'build/bundle.min.js',
			format: 'cjs',
		},
		{
			presets: [
				[
					'@babel/preset-env',
					{
						useBuiltIns: 'usage',
						corejs: 3,
						targets: '> 1%',
						modules: false,
					},
				],
			],
			exclude: [/\/core-js\//],
		}
	),
	config(
		{
			file: 'build/bundle.min.mjs',
			format: 'esm',
		},
		{
			presets: [
				[
					'@babel/preset-env',
					{
						targets: { esmodules: true },
					},
				],
			],
		}
	),
];
