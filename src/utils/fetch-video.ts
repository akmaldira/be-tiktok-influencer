import axios from "axios";
import { TiktokCreatorVideo } from "thread/tiktok-types";

export const isValidTiktokVideo = (videoUrl: string): boolean => {
  if (videoUrl.includes("tiktok") && videoUrl.includes("video")) {
    return true;
  }

  return false;
};

export const fetchVideo = async (
  videoUrl: string,
): Promise<{
  like: number;
  share: number;
  comment: number;
  view: number;
  collect: number;
  engagementRate: number;
}> => {
  const response = await axios.get(videoUrl);
  const data = response.data;

  const match = data.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"([^>]+)>([^<]+)<\/script>/,
  );
  if (!match) {
    if (data.includes("Please wait...")) {
      throw new Error(`Tiktok website is loading, please try again later...`);
    }
    throw new Error(
      `Cannot find video detail in HTML, please try again later...`,
    );
  }

  const jsonData = JSON.parse(match[2]) as any;
  const videoDetailJsonData =
    jsonData["__DEFAULT_SCOPE__"]["webapp.video-detail"];
  if (videoDetailJsonData.statusCode !== 0) {
    if (videoDetailJsonData.statusCode === 10204) {
      throw new Error(`Video ${videoUrl} was not found`);
    } else {
      throw new Error(
        `Cannot fetch video detail because ${videoDetailJsonData.statusMsg}, please try again later...`,
      );
    }
  }

  const videoDetail = videoDetailJsonData?.itemInfo?.itemStruct as
    | TiktokCreatorVideo
    | undefined;
  if (!videoDetail) {
    throw new Error(
      `Cannot find video detail in JSON, please contact support...`,
    );
  }

  let engagementRate = 0;
  const stats = getStats(videoDetail);
  if (
    stats.like == 0 ||
    stats.comment == 0 ||
    stats.share == 0 ||
    stats.view == 0
  ) {
    engagementRate = 0;
  } else {
    engagementRate =
      ((stats.like + stats.comment + stats.share) / stats.view) * 100;
  }

  return {
    ...stats,
    engagementRate,
  };
};

export const getStats = ({ stats, statsV2 }: { stats: any; statsV2: any }) => {
  const like = isNaN(parseInt(statsV2.diggCount))
    ? stats.diggCount
    : parseInt(statsV2.diggCount);
  const share = isNaN(parseInt(statsV2.shareCount))
    ? stats.shareCount
    : parseInt(statsV2.shareCount);
  const comment = isNaN(parseInt(statsV2.commentCount))
    ? stats.commentCount
    : parseInt(statsV2.commentCount);
  const view = isNaN(parseInt(statsV2.playCount))
    ? stats.playCount
    : parseInt(statsV2.playCount);

  const collect = isNaN(parseInt(statsV2.collectCount))
    ? typeof stats.collectCount == "string"
      ? parseInt(stats.collectCount)
      : stats.collectCount
    : parseInt(statsV2.collectCount);
  return { like, share, comment, view, collect };
};
