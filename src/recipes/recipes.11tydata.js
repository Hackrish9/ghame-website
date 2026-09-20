export default {
  layout: "layouts/recipe.njk",
  eleventyComputed: {
    permalink: (data) => (data.published === false ? false : `/recipes/${data.page.fileSlug}/`),
    ogImage: (data) => data.image || "",
  },
};
