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

  const extraFields =
    (add ?? []).map(f =>
      typeof f === 'function' ? f(ctx) : f
    )

  return [
    ...Object.keys(baseFields)
      .map(key => {
        const field = baseFields[key];
        return typeof field === 'function'
          ? field(ctx)
          : field;
      }),
    ...optionalKeys
      .filter(key => !safeRemove.includes(key))
      .map(key => {
        const field = optionalFields[key];
        return typeof field === 'function'
          ? field(ctx)
          : field;
      }),
    ...extraFields,
  ];
}