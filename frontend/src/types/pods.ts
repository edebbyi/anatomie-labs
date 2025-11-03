export interface PodSummary {
  id: string;
  name: string;
  description?: string | null;
  imageCount: number;
  coverImageUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
