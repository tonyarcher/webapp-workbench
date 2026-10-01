/// <reference types="vite/client" />

declare module '*.css' {
    const css: CSSStyleSheet;
    export default css;
}

declare module '*.css?inline' {
    const content: string;
    export default content;
}
