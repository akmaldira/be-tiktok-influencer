import CreatorEntity from "../src/database/entities/creator.entity";
import TiktokCountryEntity from "../src/database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "../src/database/entities/tiktok-industry.entity";

export type CountryInfo = {
  id: string;
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
  trend: HashtagTrend[];
  publish_cnt: number;
  video_views: number;
  rank: number;
  is_promoted: boolean;
};

export type TiktokSyncHelperProps = {
  saveLog?: boolean;
  workerName: string;
  maxTryCount?: number;
  maxTryCountInitialHeaders?: number;
  onGetInitialHeadersMaxTry?: (error: any) => void;
};

export type SetDefaultHeadersProps = {
  timeStamp: string;
  anonymousUserId: string;
  userSign: string;
};

export type GetManyVideosByManyHashtagProps = {
  hashtags: string[];
  country: {
    id: string;
  };
  industry: {
    id: string;
    value: string;
  };
};

export type VideoAuthor = {
  uniqueId: string;
  country: { id: string };
  hashtag: string;
};

export type GetPopularHashtagProps = {
  tryCount?: number;
  filter: {
    page: number;
    limit: number;
    period: number;
    country_code: string;
    industry_id: string;
    sort_by: "popular";
  };
};

export type GetCraetorStatsProps = {
  creator: CreatorEntity;
  tryCount?: number;
};

export type GetPopularHashtagResponse = {
  list: PopularHashtag[];
  pagination:
    | {
        has_mode: boolean;
      }
    | any;
};

export type GetCreatorDetailByVideoAuthorProps = {
  author: VideoAuthor;
  tryCount?: number;
};

export type GetHashtagFilterFromTiktokResponse = {
  country: TiktokCountryEntity[];
  industry: TiktokIndustryEntity[];
};

export type RunWorkerProps = {
  country: TiktokCountryEntity;
  industries: TiktokIndustryEntity[];
  workerName: string;
};

export type WorkerMessage =
  | {
      country: TiktokCountryEntity;
      industries: TiktokIndustryEntity[];
      workerName: string;
    }
  | undefined;

export type WorkerResponse = string;

export type CreatorDetail = {
  id: string;
  uniqueId: string;
  nickname: string | null;
  avatarThumb: string | null;
  signature: string | null;
  verified: boolean | null;
  bioLink: { link: string; risk: number } | null;
  privateAccount: boolean | null;
  region: string | null;
  language: string | null;
};

export type CreatorStats = {
  followerCount: number | null;
  followingCount: number | null;
  heart: number | null;
  heartCount: number | null;
  videoCount: number | null;
  diggCount: number | null;
  friendCount: number | null;
};

export type CreatorDetailResponse = {
  user: CreatorDetail;
  stats: CreatorStats;
};

export type VideoStats = {
  collectCount: number;
  commentCount: number;
  diggCount: number;
  playCount: number;
  shareCount: number;
};

export type VideoHashtag = {
  hashtagName: string;
  isCommerce: boolean;
};

export type CreatorVideo = {
  author: CreatorDetail;
  stats: VideoStats | null;
  textExtra: VideoHashtag[];
};

export type GetCreatorVideosResponse = {
  cursor: string;
  hasMore: boolean;
  itemList: CreatorVideo[];
};

export type GetCreatorStatsResponse = {
  viewCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
};
