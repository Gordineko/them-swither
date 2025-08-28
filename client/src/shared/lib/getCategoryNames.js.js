import { useMemo } from "react";

export function getCategoryNames(categories, chooseCategorySlug, chooseSubCategorySlug) {
  return useMemo(() => {
    if (!categories.length) return { categoryName: null, subCategoryName: null };

    const linkLength =
      (chooseCategorySlug ? 1 : 0) + (chooseSubCategorySlug ? 1 : 0);

    const category = categories.find(
      (c) =>
        c.linkName ===
        (linkLength > 1 ? chooseSubCategorySlug : chooseCategorySlug)
    );

    const subCategory = category?.subcategories?.find(
      (s) =>
        s.linkName ===
        (linkLength > 1 ? chooseCategorySlug : chooseSubCategorySlug)
    );

    return {
      categoryName: category?.name || null,
      categoryLink: category?.linkName || null,
      subCategoryName: subCategory?.name || null,
    };
  }, [categories, chooseCategorySlug, chooseSubCategorySlug]);
}
