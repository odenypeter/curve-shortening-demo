import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';

export default {
    input: 'src/csf.ts',
    output: {
        file: 'build/bundle.mjs',
        format: 'esm',
        sourcemap: true,
    },
    onwarn(warning) {
        console.error(`(!) ${warning.message}`);
    },
    plugins: [
        typescript(),
        nodeResolve({
            jsnext: true,
            main: true,
            browser: true,
            preferBuiltins: true,
        }),
        commonjs(),
        globals(),
        builtins()
    ],
    format: 'iife'
}
