/** Ambient CSS-module declarations so the client TSX typechecks the class-map imports. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
