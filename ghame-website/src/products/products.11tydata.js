// Every file in src/products becomes a product page at /shop/<file-name>/.
// Unpublished products get no page and stay out of the shop.
export default {
  layout: "layouts/product.njk",
  eleventyComputed: {
    permalink: (data) => (data.published === false ? false : `/shop/${data.page.fileSlug}/`),
    ogImage: (data) => data.images?.[0]?.src || "",
  },
};
