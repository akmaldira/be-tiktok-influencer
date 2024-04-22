import CampaignAnalysisEntity from "database/entities/campaign-analysis.entity";

export const analysisResponseSpec = (analysis: CampaignAnalysisEntity) => {
  return {
    id: analysis.id,
    campaignName: analysis.campaignName,
    details: analysis.details.map((detail) => ({
      likeCount: Number(detail.likeCount),
      commentCount: Number(detail.commentCount),
      shareCount: Number(detail.shareCount),
      viewCount: Number(detail.viewCount),
      collectCount: Number(detail.collectCount),
      cost: detail.cost ? Number(detail.cost) : null,
      engagementRate: Number(Number(detail.engagementRate).toFixed(2)),
      oldData: detail.oldData ? JSON.parse(detail.oldData) : [],
    })),
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
};
