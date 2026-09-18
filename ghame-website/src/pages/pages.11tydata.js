// Information pages (privacy, terms, delivery and returns, FAQ, and any
// page staff add later) at /<file-name>/.
export default {
  layout: "layouts/info.njk",
  eleventyComputed: {
    permalink: (data) => (data.published === false ? false : `/${data.page.fileSlug}/`),
  },
};
