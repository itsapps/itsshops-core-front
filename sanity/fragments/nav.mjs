// core-front/sanity/fragments/nav.mjs
export function navPage() {
  return `
    _type,
    title,
    "pageId": page->_id
  `;
}

export function navLink() {
  return `
    _type,
    title,
    url
  `;
}

export function subMenu({ navPage, navLink }) {
  return `
    _type,
    title,
    items[]{
      _type == "navPage" => { ${navPage} },
      _type == "navLink" => { ${navLink} }
    }
  `;
}

export function menuLinks({ navPage, navLink, subMenu }) {
  return `
    _type == "navPage" => { ${navPage} },
    _type == "navLink" => { ${navLink} },
    _type == "subMenu" => { ${subMenu} }
  `;
}
