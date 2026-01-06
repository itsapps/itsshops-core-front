
export function navPage() {
  return `
    _type,
    title,
    "pageId": page->_id
  `
}
export function navLink() {
  return `
    _type,
    title,
    url
  `
}

export function navPage() {
  return `
    _type,
    title,
    url
  `
}

const subMenuLinks = `
  _type == 'navPage' => {
    ${navPage}
  },
  _type == 'navLink' => {
    ${navLink}
  }
`

const subMenu = `
  _type,
  title,
  items[]{
    ${subMenuLinks}
  }
`
const menuLinks = `
  ${subMenuLinks},
  _type == 'subMenu' => {
    ${subMenu}
  }
`