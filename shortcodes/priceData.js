
export default function priceData(product) {
  return {
    amount: product.price,
    formatted: new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR"
    }).format(product.price)
  }
}
