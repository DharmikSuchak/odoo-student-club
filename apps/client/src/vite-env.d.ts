/// <reference types="vite/client" />

// Teach TypeScript about CSS Modules.
// Each imported .module.css file has string keys for class names.
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
