export const errorPagePermalink = (locale) => {
  return `/${locale}/404/`
}
export const homePermalink = (locale) => {
  return `/${locale}/`
}
export const pagePermalink = (locale, slug) => {
  return `/${locale}/${slug}/`
}
export const blogPermalink = (locale, t, index) => {
  return `/${locale}/${t('dynamicPages.blogPosts.path', {}, locale)}/${index ? `${t('dynamicPages.blogPosts.page', {}, locale)}/${index+1}/` : ''}`
}
export const blogPostPermalink = (locale, t, slug) => {
  return `/${locale}/${t('dynamicPages.blogPost.path', {}, locale)}/${slug}/`
}
export const productPermalink = (locale, t, slug) => {
  return `/${locale}/${t('dynamicPages.products.path', {}, locale)}/${slug}/`
}
export const categoryPermalink = (locale, t, slug) => {
  return `/${locale}/${t('dynamicPages.categories.path', {}, locale)}/${slug}/`
}
export const userLoginPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userLogin', {ns: 'shared'}, locale)}`
}
export const userConfirmPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userConfirm', {ns: 'shared'}, locale)}`
}
export const userResetPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userReset', {ns: 'shared'}, locale)}`
}
export const userConfirmSuccessPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userConfirmSuccess', {ns: 'shared'}, locale)}`
}
export const userRecoverPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userRecover', {ns: 'shared'}, locale)}`
}
export const userRecoverSuccessPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userRecoverSuccess', {ns: 'shared'}, locale)}`
}
export const userResetSuccessPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userResetSuccess', {ns: 'shared'}, locale)}`
}
export const userRegistrationPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userRegistration', {ns: 'shared'}, locale)}`
}
export const userRegistrationSuccessPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userRegistrationSuccess', {ns: 'shared'}, locale)}`
}
export const orderThankYouPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.orderThankYou', {ns: 'shared'}, locale)}`
}
export const checkoutPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.checkout', {ns: 'shared'}, locale)}`
}
export const userOrdersPermalink = (locale, t) => {
  return `/${locale}/${t('urlPaths.userOrders', {ns: 'shared'}, locale)}`
}
