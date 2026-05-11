import { z } from "zod";

export const CreateReviewDto = z.object({
  appointmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const UpdateReviewDto = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const ListReviewsDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export type CreateReviewDtoType = z.infer<typeof CreateReviewDto>;
export type UpdateReviewDtoType = z.infer<typeof UpdateReviewDto>;
export type ListReviewsDtoType = z.infer<typeof ListReviewsDto>;
