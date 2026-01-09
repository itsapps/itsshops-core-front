import slugify from '@sindresorhus/slugify';

export const slugifyString = str => {
	return slugify(str, {
		separator: '-',
		lowercase: true
	});
};

export const getUniqueSlug = (slug, slugSet) => {
  let counter = 0
  let actualSlug = null
  while (!actualSlug) {
	actualSlug = slug
	if (counter > 0) {
	  actualSlug = `${slug}-${counter}`
	}
	if (slugSet.has(actualSlug)) {
	  actualSlug = null
	  counter++
	} else {
	  slugSet.add(actualSlug)
	  return actualSlug
	}
  }
}

export const uniqueFilteredArray = (array, filterValue) => {
	const values = new Set(array);
  const filteredValues = Array.from(values).filter(value => value !== filterValue);
	return filteredValues;
};

export const uniqueShuffeledStrings = (strings, filterValue, max=4) => {
  const filtered = uniqueFilteredArray(strings, filterValue);
  return _.shuffle(filtered).slice(0, max)
}