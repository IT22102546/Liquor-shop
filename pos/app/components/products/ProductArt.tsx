"use client";

import type { ReactNode } from "react";
import { API_URL } from "../../lib/constants";
import { IconBeerGlass, IconBottle, IconCocktail, IconSnack, IconSodaCan, IconTumbler, IconWineGlass } from "../../lib/icons";

type ArtStyle = { Icon: (props: { size?: number }) => JSX.Element; color: string };

// Picks drink artwork and a tint from the category name, for products without a photo.
function artFor(category: string): ArtStyle {
  const name = category.toLowerCase();
  if (/beer|lager|stout|ale|cider/.test(name)) return { Icon: IconBeerGlass, color: "#e3a83b" };
  if (/wine|champagne|sparkling|prosecco/.test(name)) return { Icon: IconWineGlass, color: "#c75a73" };
  if (/whisk|brandy|rum|arrack|cognac|bourbon|scotch/.test(name)) return { Icon: IconTumbler, color: "#d98a4e" };
  if (/cocktail|liqueur|shot/.test(name)) return { Icon: IconCocktail, color: "#8e86e8" };
  if (/mixer|soda|soft|juice|water|tonic|cola|energy/.test(name)) return { Icon: IconSodaCan, color: "#4fa8d8" };
  if (/snack|nut|chip|food|bite/.test(name)) return { Icon: IconSnack, color: "#e0894a" };
  return { Icon: () => <IconBottle />, color: "#4fb7a8" };
}

export function ProductArt({
  categoryName,
  imageUrl,
  alt,
  className = "pos-product-art",
  iconSize = 46,
  children,
}: {
  categoryName: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  iconSize?: number;
  children?: ReactNode;
}) {
  const { Icon, color } = artFor(categoryName);
  return (
    <div className={className} style={{ ["--art-color" as string]: color }}>
      {imageUrl ? <img src={`${API_URL}${imageUrl}`} alt={alt} loading="lazy" /> : <Icon size={iconSize} />}
      {children}
    </div>
  );
}
