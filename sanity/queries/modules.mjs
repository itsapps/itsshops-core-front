export function buildModulesQuery({ enabled, modules }) {
  return enabled
    .map(
      (name) => `
        _type == "${name}" => {
          _key,
          ${modules[name]}
        }
      `
    )
    .join(',');
}
