export function resolveFields(
  baseFields,
  optionalFields, {
    add = [],
    remove = [],
  } = {},
  ctx = {}
) {
  const optionalKeys = Object.keys(optionalFields);
  const removable = new Set(optionalKeys);
  const safeRemove = remove.filter(f => removable.has(f));

  return [
    ...baseFields,
    ...optionalKeys
      .filter(key => !safeRemove.includes(key))
      .map(key => {
        const field = optionalFields[key];
        return typeof field === 'function'
          ? field(ctx)
          : field;
      }),
    ...add,
  ];
}