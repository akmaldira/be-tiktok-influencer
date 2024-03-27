import CreatorView from "database/entities/creator-view.entity";
import CreatorEntity from "database/entities/creator.entity";

export const creatorResponseSpec = (creator: CreatorEntity | CreatorView) => {
  if (creator instanceof CreatorEntity) {
    throw new Error("CreatorEntity response spec is not implemented yet");
  } else {
    let uniqueCategories = null as string[] | null;
    if (creator.potentialCategories) {
      const categoriesJoined = creator.potentialCategories.flat(1);
      const mapCategories = {} as { [key: string]: number };
      categoriesJoined.forEach((category) => {
        mapCategories[category] = (mapCategories[category] || 0) + 1;
      });
      uniqueCategories = Object.keys(mapCategories).sort(
        (a, b) => mapCategories[b] - mapCategories[a],
      );
      creator.potentialCategories = uniqueCategories as any;
    }

    let uniqueSuggestedWords = null as string[] | null;
    if (creator.suggestedWords) {
      const suggestedWordsJoined = creator.suggestedWords.flat(1);
      const mapSuggestedWords = {} as { [key: string]: number };
      suggestedWordsJoined.forEach((word) => {
        mapSuggestedWords[word] = (mapSuggestedWords[word] || 0) + 1;
      });
      uniqueSuggestedWords = Object.keys(mapSuggestedWords).sort(
        (a, b) => mapSuggestedWords[b] - mapSuggestedWords[a],
      );
      creator.suggestedWords = uniqueSuggestedWords as any;
    }

    let uniqueAddress = null as string[] | null;
    if (creator.address) {
      const mapAddress = {} as { [key: string]: number };
      creator.address.forEach((address) => {
        mapAddress[address] = (mapAddress[address] || 0) + 1;
      });
      uniqueAddress = Object.keys(mapAddress).sort(
        (a, b) => mapAddress[b] - mapAddress[a],
      );
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
      const mapHashtags = {} as { [key: string]: number };
      creator.textExtras.forEach((textExtra) => {
        if (!textExtra) return;
        textExtra.forEach((extra) => {
          if (!extra.hashtagName) return;
          mapHashtags[extra.hashtagName] =
            (mapHashtags[extra.hashtagName] || 0) + 1;
        });
      });
      uniqueHashtags = Object.keys(mapHashtags).sort(
        (a, b) => mapHashtags[b] - mapHashtags[a],
      );
      creator.textExtras = uniqueHashtags as any;
    }
  }

  return creator;
};
