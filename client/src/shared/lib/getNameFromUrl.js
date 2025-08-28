import { useRouter } from "next/router";

export const getName = (
  categorySlug,
  subcategorySlug,
  prodSlug,
  categories
) => {
  const { locale } = useRouter();

  if (categorySlug && !subcategorySlug) {
    const chooseCategory = categories.find(
      (el) => el.linkName === categorySlug
    );

    return {
      categoryName: chooseCategory?.name?.[locale] ?? "",
      categoryLink: categorySlug,
    };
  } else if (categorySlug && subcategorySlug) {
    const chooseCategory = categories.find(
      (el) => el.linkName === subcategorySlug
    );
    const chooseSubCategory = chooseCategory.subcategories.find(
      (el) => el.linkName === categorySlug
    );

    return {
      categoryName: chooseCategory.name[locale],
      categoryLink: subcategorySlug,
      subCategoryName: chooseSubCategory.name[locale],
      subCategoryLink: categorySlug,
    };
  }
};
