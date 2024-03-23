export type TiktokCredentials = {
  "Anonymous-User-Id": string;
  Timestamp: string;
  "User-Sign": string;
};

export type TiktokHelperConstructor = {
  saveLog?: boolean;
  workerName: string;
  maxTry?: number;
  maxTryInitialHeader?: number;
  onInitialHeaderMaxTry?: (error: Error | any) => void;
};

export type CountryInfo = {
  id: string;
  value: string;
  label: string;
};

export type IndustryInfo = {
  id: number;
  value: string;
  label: string;
};

export type HashtagTrend = {
  time: number;
  value: number;
};

export type PopularHashtag = {
  hashtag_id: string;
  hashtag_name: string;
  country_info: CountryInfo;
  industry_info: IndustryInfo;
  trend: HashtagTrend[];
  publish_cnt: number;
  video_views: number;
  rank: number;
  is_promoted: boolean;
};

export type TiktokPopularHashtagFilter = {
  page: number;
  limit: 10 | 20 | 50;
  period: 7 | 30 | 120;
  country_code: string;
  industry_id: string;
  sort_by: "popular";
};

export type TiktokPopularHashtagProps = {
  tryCount?: number;
  filter: TiktokPopularHashtagFilter;
};

export type TiktokPopularHashtagResponse = {
  list: PopularHashtag[];
  pagination: {
    page: number;
    size: number;
    total: number;
    has_more: boolean;
  };
};

export type TiktokFilterResponse = {
  country: CountryInfo[];
  industry: CountryInfo[];
};

export type TiktokVideosByHashtagProps = {
  hashtag: string;
  limit?: number;
  tryCount?: number;
};

export type TiktokVideoAuthor = {
  avatarLarger: string | null;
  avatarMedium: string | null;
  avatarThumb: string | null;
  commentSetting: number | null;
  downloadSetting: number | null;
  duetSetting: number | null;
  ftc: boolean | null;
  id: string;
  isADVirtual: boolean | null;
  isEmbedBanned: boolean | null;
  nickname: string | null;
  openFavorite: boolean | null;
  privateAccount: boolean | null;
  relation: number | null;
  secUid: string | null;
  secret: boolean | null;
  signature: string | null;
  stitchSetting: number | null;
  ttSeller: boolean | null;
  uniqueId: string;
  verified: boolean | null;
};

export type TiktokVideoStats = {
  diggCount: number | null;
  followerCount: number | null;
  followingCount: number | null;
  friendCount: number | null;
  heart: number | null;
  heartCount: number | null;
  videoCount: number | null;
};

export type VideoTextExtra = {
  awemeId: string;
  end: number | null;
  hashtagId: string | null;
  hashtagName: string | null;
  isCommerce: false;
  secUid: string | null;
  start: number | null;
  subType: number | null;
  type: number | null;
  userId: string | null;
  userUniqueId: string | null;
};

export type TiktokVideoTimelineByHashtag = {
  id: string;
  BAInfo: string | null;
  adAuthorization: boolean | null;
  adLabelVersion: number | null;
  aigcLabelType: number | null;
  author: TiktokVideoAuthor;
  authorStats: TiktokVideoStats | null;
  contents: { desc: string; textExtra: VideoTextExtra[] }[] | null;
  createTime: number | null;
  desc: string | null;
  textExtra: VideoTextExtra[];
  stats: {
    collectCount: number;
    commentCount: number;
    diggCount: number;
    playCount: number;
    shareCount: number;
  };
  statsV2: {
    collectCount: string;
    commentCount: string;
    diggCount: string;
    playCount: string;
    shareCount: string;
  };
};

export type TiktokVideoTimelineWithHashtag = TiktokVideoTimelineByHashtag & {
  hashtag: PopularHashtag;
};

export type TiktokVideosByHashtagResponse = {
  cursor: string;
  hasMore: boolean;
  itemList: TiktokVideoTimelineByHashtag[];
};

export type TiktokCreatorDetailAndVideosProps = {
  uniqueId: string;
  tryCount?: number;
};

export type TiktokVideoDetailProps = {
  videoId: string;
  uniqueId: string;
  tryCount?: number;
};

export type TiktokCreatorDetail = TiktokVideoAuthor & {
  bioLink: {
    link: string | null;
  } | null;
  language: string | null;
  region: string | null;
};

export type TiktokCreatorVideo = TiktokVideoTimelineByHashtag & {
  suggestedWords: string[] | null;
  diversificationLabels: string[] | null;
  locationCreated: string | null;
  contentLocation: {
    address: {
      addressCountry: string | null;
      addressLocality: string | null;
      addressRegion: string | null;
      streetAddress: string | null;
    } | null;
  } | null;
  poi: {
    name: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    id: string | null;
    fatherPoiName: string | null;
    type: string | null;
    cityCode: string | null;
    countryCode: string | null;
  } | null;
};
