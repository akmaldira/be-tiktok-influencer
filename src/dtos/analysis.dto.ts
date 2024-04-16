import VideoAnalysisEntity from "database/entities/analysis.entity";

export const analysisResponseSpec = (analysis: VideoAnalysisEntity) => {
  return {
    id: analysis.id,
    videoUrl: analysis.videoUrl,
    likeCount: Number(analysis.likeCount),
    commentCount: Number(analysis.commentCount),
    shareCount: Number(analysis.shareCount),
    viewCount: Number(analysis.viewCount),
    collectCount: Number(analysis.collectCount),
    oldData: analysis.oldData ? JSON.parse(analysis.oldData) : [],
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
};
