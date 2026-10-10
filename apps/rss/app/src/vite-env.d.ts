/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE?: string;
}

declare module '*.css?inline' {
    const css: string;
    export default css;
}
