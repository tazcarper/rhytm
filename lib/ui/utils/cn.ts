// Six-line className joiner. Joins truthy strings with spaces and drops
// everything else (false, null, undefined). Cheaper than pulling in clsx
// or classnames as a dependency and easier to grep than a one-liner.
export function cn(
  ...args: Array<string | false | null | undefined>
): string {
  return args.filter(Boolean).join(" ");
}
