import { pictureSizes } from '../../../_config/image-settings.mjs';
import { debounce } from '../lib/debounce.ts';
import { updateBodyPadding, importWithTimeout, replacePicture } from '../lib/utils.ts';
import { getLocalSearchIds, setLocalSearchIds } from '../lib/local-storage.ts';
import { createTranslator, BrowserTranslations } from '../lib/translation.ts';

type  SearchConfig = {
  fields: string[],
  storeFields: string[],
  searchOptions: {
    prefix: boolean,
    fuzzy: number
  }
}
type SearchTypes = {
  products: SearchConfig;
  categories: SearchConfig;
};
type SearchTypeKey = keyof SearchTypes;

type ProductResultItem = {
  id: string;
  title: string;
  url: string;
  img: string;
  categoryIds: string[];
}
type CategoryResultItem = {
  id: string;
  title: string;
  url: string;
  img: string;
}

type SearchJson = {
  products: ProductResultItem[];
  categories: CategoryResultItem[];
}

type MiniSearch = {
  addAllAsync: (items: any[]) => Promise<void>;
  search: (query: string) => any[];
  _idToShortId: Map<string, string>;
  _storedFields?: Map<string, any>;
}
type Minisearches = {
  products?: MiniSearch;
  categories?: MiniSearch;
}

const searchTypes: SearchTypes = {
  products: {
    fields: ['title'],
    storeFields: ['categoryIds', 'id', 'title', 'url', 'img'],
    searchOptions: { prefix: true, fuzzy: 0.2 }
  },
  categories: {
    fields: ['title'],
    storeFields: ['id', 'title', 'url', 'img'],
    searchOptions: { prefix: true, fuzzy: 0.2 }
  },
};

const miniSearches: Minisearches = {};
let searchData: SearchJson | null = null;
const limit = 6;

const translations: BrowserTranslations = {
  en: {
    noInternet: 'No internet connection',
    noResults: 'No results found',
    oneResult: '1 result found',
    manyResults: '{{count}} results found',
  },
  de: {
    noInternet: 'Keine Internetverbindung',
    noResults: 'Keine Ergebnisse gefunden',
    oneResult: '1 Ergebnis gefunden',
    manyResults: '{{count}} Ergebnisse gefunden',
  }
}

const t = createTranslator(translations);

const searchContainer = document.getElementById('search');
if (!searchContainer) {
  throw new Error('Search container not found');
}
const searchInput = searchContainer.querySelector('[data-name="search-input"]')! as HTMLInputElement;
const searchError = searchContainer.querySelector('[data-name="search-error"]')! as HTMLDivElement;
const retryButton = searchError.querySelector('button')! as HTMLButtonElement;
retryButton.addEventListener('click', async () => {
  await fetchSearchData();
  await focusSearchInput();
})
const searchLiveRegion = document.getElementById('search-live-region')! as HTMLDivElement;
const searchClose = document.getElementById('search-close') as HTMLButtonElement;
const searchOuter = searchContainer.querySelector('[data-name="search-outer"]')!;
const searchLoader = searchContainer.querySelector('[data-name="search-loader"]')! as HTMLDivElement;
const itemTemplate = document.getElementById('search-item-template') as HTMLTemplateElement;
const resultContainers = Object.assign({}, ...Object.keys(searchTypes).map(x => ({[x]: document.getElementById(`results-${x}`)})));
const resultLists = Object.assign({}, ...Object.keys(searchTypes).map(x => ({[x]: document.getElementById(`search-results-list-${x}`)}))) as {[key: string]: HTMLUListElement};
const pictureDefinition = pictureSizes.productXS;

const buttons = document.querySelectorAll('[data-toggle-search]') as NodeListOf<HTMLButtonElement>;

// avoid drawer flashing on page load
setTimeout(() => {
  buttons.forEach(toggle => {
    const sidebarID = toggle.dataset.toggleSearch;
    const sidebarElement = sidebarID ? document.getElementById(sidebarID) : undefined;
    if (sidebarElement) {
      sidebarElement.removeAttribute('data-no-flash');
    }
  });
}, 100);
buttons.forEach(toggle => {
  toggle.addEventListener('click', async (e) => {
    let isExpanded = toggle.getAttribute('aria-expanded');
    const shouldExpand = isExpanded === 'false' ? true : false;
    
    updateBodyPadding(shouldExpand);
    toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');

    if (shouldExpand) {
      await fetchSearchData();
      if (shouldExpand && searchInput) {
        await focusSearchInput();
      }
    }
  });
});
const focusSearchInput = async () => {
  setTimeout(() => {
    searchInput.focus();
  }, 50); // slight delay in case of transition/DOM update
}
searchOuter.addEventListener('click', () => {
  disableMenu();
});
searchClose.addEventListener('click', () => {
  disableMenu();
});
document.addEventListener('keyup', e => {
  if (e.code === 'Escape') {
    disableMenu();
  }
});

const disableMenu = () => {
  updateBodyPadding(false);
  buttons.forEach(toggle => {
    toggle.setAttribute('aria-expanded', "false");
  });
};

const fetchSearchData = async () => {
  searchLoader.dataset.loading = "true";
  searchError.dataset.hasError = "false";
  // Dynamically import MiniSearch
  try {
    if (Object.keys(miniSearches).length === 0) {
      await importWithTimeout('/assets/scripts/hydrated/minisearch.js');

      Object.entries(searchTypes).forEach(([searchType, config]) => {
        const searchOptions = {...config.searchOptions};
        // if (config.processTerm) {
        //   searchOptions.processTerm = window.MiniSearch.getDefault('processTerm')
        // }
        const newConfig = {...config, searchOptions}
        miniSearches[searchType as SearchTypeKey] = new (window as any).MiniSearch(newConfig);
      });
    }

    if (!searchData) {
      const response = await fetch(`/product_search_${document.documentElement.lang}.json`);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      searchData = await response.json();
      
      for (const [searchType, data] of Object.entries(searchData!)) {
        const miniSearch = miniSearches[searchType as SearchTypeKey];
        if (miniSearch) {
          await miniSearch.addAllAsync(data);
        }
      }
    }
  } catch (e: Error | any) {
    const p = searchError.querySelector('p')!;
    if (e.name === "TypeError") {
      p.textContent = t('noInternet');
    } else {
      p.textContent = e.message;
    }
    searchError.dataset.hasError = "true";
  } finally {
    // delay(() => {
    searchLoader.dataset.loading = "false";
    // }, 2000)
  }
}

const resultClicked = (itemId: string) => {
  const searchIds = getLocalSearchIds();
  searchIds.push(itemId);
  setLocalSearchIds(searchIds);
}

const getItemById = (itemId: string, searchType: SearchTypeKey) => {
  const miniSearch = miniSearches[searchType]
  if (!miniSearch) {
    return null;
  }
  const shortId = miniSearch._idToShortId.get(itemId)
  if (shortId === undefined) {
    return null;
  }
  return miniSearch._storedFields?.get(shortId);
}

const render = (results: ProductResultItem[] | CategoryResultItem[], searchType: string) => {
  // Clear previous results
  const resultContainer = resultContainers[searchType]
  const listElement = resultLists[searchType] as HTMLUListElement
  // listElement.replaceChildren();
  const fragment = document.createDocumentFragment();


  // Display the search results
  resultContainer.setAttribute('data-has-results', results.length > 0);
  // hide if no items 
  for (const result of results) {
    const clone = itemTemplate.content.cloneNode(true) as DocumentFragment;

    const link = clone.querySelector('[data-name="result-item-title"]') as HTMLAnchorElement;
    link.textContent = result.title;
    link.href = result.url;
    link.addEventListener('click', () => {
      resultClicked(result.id);
    });

    const linkType = clone.querySelector('[data-name="result-item-type"]')!
    if (searchType === 'products') {
      const resultItem = result as ProductResultItem
      linkType.textContent = resultItem.categoryIds.map(categoryId => {
        const category = getItemById(categoryId, 'categories')
        if (!category) {
          return null;
        }
        return category.title
      }).filter(Boolean).join(', ');
    }
    else {
      linkType.remove();
    }

    const picture = clone.querySelector('[data-name="photo"] picture')! as HTMLPictureElement;
    if (result.img) {
      replacePicture(picture, result.img, pictureDefinition, result.title);
    }
    // listElement.appendChild(clone);
    fragment.appendChild(clone);
  }
  listElement.innerHTML = '';
  listElement.appendChild(fragment);

}

const announceResults = (count: number) => {
  const message = count === 0
    ? t('noResults')
    : (count === 1 ? t('oneResult') : t('manyResults', { count }));

  searchLiveRegion.textContent = message;
};

const handleEmptySearch = () => {
  let searchIds = getLocalSearchIds();
  requestAnimationFrame(() => {
    Object.keys(miniSearches).forEach((searchType) => {
      const results = searchIds.map(id => getItemById(id, searchType as SearchTypeKey)).filter(Boolean).slice(0, limit);
      render(results, searchType);
    })
  });
  announceResults(0)
}
if (searchInput) {
  searchInput.addEventListener('focus', async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.value !== '') {
      return;
    }
    handleEmptySearch();
  });

  const debouncedSearch = debounce(async (e: Event) => {
    const div = e.target as HTMLInputElement;
    const text = div.value;
    if (text === '') {
      handleEmptySearch();
      return;
    }

    // await fetchSearchData();
    if (Object.keys(miniSearches).length > 0) {
      requestAnimationFrame(() => {
        let numResults = 0;
        Object.entries(miniSearches).forEach(([searchType, miniSearch]) => {
          const results = miniSearch.search(text).slice(0, limit);
          numResults += results.length;
          render(results, searchType);
        });
        announceResults(numResults)
      });
    }
  }, 300);
  
  searchInput.addEventListener('input', debouncedSearch);

}