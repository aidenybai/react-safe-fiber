/// <reference types="vite/client" />
/// <reference types="astro/client" />

declare module 'virtual:svg-sprite' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const styles: string;
  export default styles;
}
