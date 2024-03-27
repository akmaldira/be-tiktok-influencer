import CreatorView from "database/entities/creator-view.entity";
import CreatorEntity from "database/entities/creator.entity";

export const creatorResponseSpec = (creator: CreatorEntity | CreatorView) => {
  if (creator instanceof CreatorEntity) {
    throw new Error("CreatorEntity response spec is not implemented yet");
  } else {
    let uniqueCategories = null as string[] | null;
    if (creator.potentialCategories) {
      const categoriesJoined = creator.potentialCategories.flat(1);
      const mapCategories = new Map() as Map<string, string>;
      categoriesJoined.forEach((category) => {
        mapCategories.set(category, category);
      });
      uniqueCategories = Array.from(mapCategories.values());
      creator.potentialCategories = uniqueCategories as any;
    }

    let uniqueSuggestedWords = null as string[] | null;
    if (creator.suggestedWords) {
      const suggestedWordsJoined = creator.suggestedWords.flat(1);
      const mapSuggestedWords = new Map() as Map<string, string>;
      suggestedWordsJoined.forEach((word) => {
        mapSuggestedWords.set(word, word);
      });
      uniqueSuggestedWords = Array.from(mapSuggestedWords.values());
      creator.suggestedWords = uniqueSuggestedWords as any;
    }

    let uniqueAddress = null as string[] | null;
    if (creator.address) {
      const mapAddress = new Map() as Map<string, string>;
      creator.address.forEach((address) => {
        mapAddress.set(address, address);
      });
      uniqueAddress = Array.from(mapAddress.values());
      creator.address = uniqueAddress as any;
    }

    let uniqueIndustries = [] as { id: string; label: string; value: string }[];
    if (creator.industries && creator.industries.length > 0) {
      const mapIndustries = new Map() as Map<
        string,
        { id: string; label: string; value: string }
      >;
      creator.industries.forEach((industry) => {
        mapIndustries.set(industry.id, industry);
      });
      uniqueIndustries = Array.from(mapIndustries.values());
      creator.industries = uniqueIndustries as any;
    }

    let uniqueHashtags = null as string[] | null;
    if (creator.textExtras) {
      const mapHashtags = new Map() as Map<string, string>;
      creator.textExtras.forEach((textExtra) => {
        if (!textExtra) return;
        textExtra.forEach((extra) => {
          mapHashtags.set(extra.hashtagName, extra.hashtagName);
        });
      });
      uniqueHashtags = Array.from(mapHashtags.values());
      creator.textExtras = uniqueHashtags as any;
    }
  }

  return creator;
};
